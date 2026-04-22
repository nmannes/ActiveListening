#!/bin/bash
# launch_gpu_server.sh — Automates AWS GPU instance for Kalshi transcription
# Launches G6 instance (L4 GPU), syncs code, runs server, and schedules 30m shutdown.

set -e

# --- Configuration (Defaults) ---
BUN="/home/nathan/.bun/bin/bun"
REGION="${REGION:-us-east-1}"
KEY_NAME="${KEY_NAME:-us-east-1}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/$KEY_NAME.pem}"
LOCAL_DIR="$(pwd)"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user"
AMI_ID="ami-0ec10929233384c7f"


# --- Subcommand: Destroy All ---
if [[ "$1" == "--destroy-all" ]]; then
    echo "Querying all Kalshi worker stacks in $REGION..."
    STACKS=$(aws cloudformation describe-stacks \
        --region "$REGION" \
        --query 'Stacks[?starts_with(StackName, `kalshi-worker-`) && StackStatus!=`DELETE_COMPLETE`].StackName' \
        --output text)
    if [ -z "$STACKS" ]; then
        echo "No stacks found to delete."
    else
        echo "Deleting stacks: $STACKS"
        for stack in $STACKS; do
            echo "Deleting stack $stack..."
            aws cloudformation delete-stack --region "$REGION" --stack-name "$stack"
        done
    fi
    echo "Also cleaning up any stray instances..."
    INSTANCE_IDS=$(aws ec2 describe-instances \
        --region "$REGION" \
        --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' \
        --output text)
    if [ -n "$INSTANCE_IDS" ]; then
        echo "Terminating stray instances: $INSTANCE_IDS"
        aws ec2 terminate-instances --region "$REGION" --instance-ids $INSTANCE_IDS
    fi
    exit 0
fi

# --- Environment Setup ---
ENV="demo"
INSTANCE_TYPE_ARG=""
USE_SPOT=false
SHUTDOWN_MINUTES=45
REMOTE_USER="ubuntu"
REMOTE_DIR="/home/ubuntu"

args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
    arg="${args[$i]}"
    case $arg in
        prod|demo) ENV=$arg ;;
        --spot) USE_SPOT=true ;;
        --no-rollback) NO_ROLLBACK=true ;;
        --destroy-all) ENV="--destroy-all" ;;
        --duration|--shutdown-minutes) SHUTDOWN_MINUTES="${args[$((i+1))]}"; ((i++)) ;;
        --*) ;; # Ignore unknown flags
        *) if [[ -z "$INSTANCE_TYPE_ARG" ]]; then INSTANCE_TYPE_ARG=$arg; fi ;;
    esac
done

if [[ "$ENV" != "prod" && "$ENV" != "demo" && "$ENV" != "--destroy-all" ]]; then
    echo "Usage: $0 [demo|prod|--destroy-all] [instance_type] [--spot]"
    exit 1
fi

if [[ -n "$INSTANCE_TYPE_ARG" ]]; then
    INSTANCE_TYPE="$INSTANCE_TYPE_ARG"
elif [[ "$ENV" == "prod" ]]; then
    INSTANCE_TYPE="t3.large"
else
    INSTANCE_TYPE="t3.large"
fi

SPOT_OPTIONS=""
if [[ "$USE_SPOT" == true ]]; then
    SPOT_OPTIONS="--instance-market-options '{\"MarketType\": \"spot\"}'"
fi

RUN_ID=$(cat /proc/sys/kernel/random/uuid | cut -d- -f1)

echo "Deploying to environment: $ENV (Ubuntu)"

# --- 0. Check for existing instance (Locked) ---
mkdir -p "$LOCAL_DIR/locks"
LOCKFILE="$LOCAL_DIR/locks/launch_${ENV}.lock"

while true; do
    if (set -o noclobber; echo "$$" > "$LOCKFILE") 2>/dev/null; then
        # Successfully acquired lock
        trap 'rm -f "$LOCKFILE"; exit $?' INT TERM EXIT
        break
    else
        # Lock exists, check if it is stale
        OTHER_PID=$(cat "$LOCKFILE" 2>/dev/null || echo "")
        if [ -z "$OTHER_PID" ] || ! kill -0 "$OTHER_PID" 2>/dev/null; then
            echo "Stale or empty lock found (PID $OTHER_PID), clearing..."
            rm -f "$LOCKFILE"
            continue
        fi
        echo "--------------------------------------------------------"
        echo "ALREADY IN PROGRESS: A $ENV launch is active (PID $OTHER_PID)"
        echo "Aborting this launch to avoid duplicates."
        echo "--------------------------------------------------------"
        exit 0
    fi
done

echo "[0/4] Checking for existing $ENV instances in $REGION..."
EXISTING_INSTANCE=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:Environment,Values=$ENV" "Name=instance-state-name,Values=running,pending" \
    --query 'Reservations[].Instances[0].InstanceId' \
    --output text | awk '{print $1}')

if [[ "$EXISTING_INSTANCE" != "None" && -n "$EXISTING_INSTANCE" ]]; then
    # Get the IP of the existing instance
    EXISTING_IP=$(aws ec2 describe-instances \
        --region "$REGION" \
        --instance-ids "$EXISTING_INSTANCE" \
        --query 'Reservations[].Instances[0].PublicIpAddress' \
        --output text)
    echo "--------------------------------------------------------"
    echo "ALREADY RUNNING: A $ENV instance is active at $EXISTING_IP"
    echo "Instance ID: $EXISTING_INSTANCE"
    echo "Aborting launch to avoid duplicates."
    echo "--------------------------------------------------------"
    $BUN run lib/telegram.js --message "Aborted launch: A $ENV instance is already active at $EXISTING_IP ($EXISTING_INSTANCE)" --channel info
    exit 0
fi

# --- 1. Get Local IP and Credentials ---
echo "[1/4] Gathering deployment context..."
MY_IP=$(curl -s https://ifconfig.me)
echo "Local IP: $MY_IP"

# Detect IP version and set CIDR suffix
if [[ "$MY_IP" == *:* ]]; then
    IP_VERSION="IPv6"
    OPERATOR_CIDR="${MY_IP}/128"
else
    IP_VERSION="IPv4"
    OPERATOR_CIDR="${MY_IP}/32"
fi

# Load credentials from local env file
ENV_FILE="$LOCAL_DIR/.env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file $ENV_FILE not found."
    exit 1
fi

KEY_ID=$(grep "KALSHI_KEY_ID" "$ENV_FILE" | cut -d= -f2 | xargs)
PRIVATE_KEY_PATH=$(grep "KALSHI_PRIVATE_KEY_PATH" "$ENV_FILE" | cut -d= -f2 | xargs)

# Allow optionally overriding the S3 bucket via .env
RECORDINGS_BUCKET=$(grep "^S3_BUCKET=" "$ENV_FILE" | cut -d= -f2 | xargs || true)
if [ -z "$RECORDINGS_BUCKET" ]; then
    RECORDINGS_BUCKET="recordings-846345203908-us-east-1-an"
fi

# Resolve relative paths in .env
if [[ "$PRIVATE_KEY_PATH" == ./* ]]; then
    PRIVATE_KEY_PATH="$LOCAL_DIR/${PRIVATE_KEY_PATH#./}"
fi

if [ ! -f "$PRIVATE_KEY_PATH" ]; then
    echo "Error: Private key not found at $PRIVATE_KEY_PATH"
    exit 1
fi

PRIVATE_KEY_CONTENT=$(cat "$PRIVATE_KEY_PATH")

if [[ "$ENV" == "prod" ]]; then
    DOMAIN="https://api.elections.kalshi.com/trade-api/v2"
else
    DOMAIN="https://demo-api.kalshi.co/trade-api/v2"
fi

# Process .env content for the instance (masking via NoEcho parameter)
ENV_CONTENT=$(cat "$ENV_FILE" | \
    sed "s/^KALSHI_KEY_ID=.*/KALSHI_KEY_ID=$KEY_ID/" | \
    sed "s/^KALSHI_ENV=.*/KALSHI_ENV=$ENV/" | \
    sed "s|^KALSHI_PRIVATE_KEY_PATH=.*|KALSHI_PRIVATE_KEY_PATH=$REMOTE_DIR/private_key.txt|" | \
    sed "s|^KALSHI_BASE_DOMAIN=.*|KALSHI_BASE_DOMAIN=$DOMAIN|")

REQUIREMENTS_CONTENT=$(cat "$LOCAL_DIR/requirements.txt")

# --- 2. Assemble and Launch Stack ---
echo "[2/4] Assembling and deploying modular CloudFormation stack..."
STACK_NAME="kalshi-worker-$RUN_ID"

# Blueprint assembly via Jinja2
BLUEPRINT_DIR="$LOCAL_DIR/ec2-instance"
TMP_TEMPLATE="/tmp/assembled_template.yaml"

python3 "$BLUEPRINT_DIR/render_template.py" "$BLUEPRINT_DIR" "template.yaml.j2" "$TMP_TEMPLATE" --env "$ENV"

# S3 bucket for template deployment (required for templates > 51KB)
S3_BUCKET="deploys"

PROVISION_START_TIME=$(date +%s)

ROLLBACK_ARG=""
if [[ "$NO_ROLLBACK" == true ]]; then
    ROLLBACK_ARG="--no-execute-changeset" # Actually, 'deploy' doesn't have --no-rollback, we need to use a different approach or just manual create-stack
    # Wait, 'aws cloudformation deploy' doesn't support --no-rollback directly.
    # It always rollbacks on failure. 
    # To prevent rollback, we'd need 'aws cloudformation create-stack --on-failure DO_NOTHING'
fi

# NOTE: Since 'deploy' is easier for updates, I'll stick with it but add a tip to the user.
# Actually, let's just make it so the user can easily debug if it fails.

if [[ "$NO_ROLLBACK" == true ]]; then
    echo "--------------------------------------------------------"
    echo "DEBUG MODE: --no-rollback enabled."
    echo "Using 'create-stack' with '--on-failure DO_NOTHING'..."
    echo "--------------------------------------------------------"
    
    aws cloudformation create-stack \
        --template-body "file://$TMP_TEMPLATE" \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --on-failure DO_NOTHING \
        --capabilities CAPABILITY_IAM \
        --parameters \
            ParameterKey=Environment,ParameterValue="$ENV" \
            ParameterKey=InstanceTypeOverride,ParameterValue="$INSTANCE_TYPE" \
            ParameterKey=UseSpot,ParameterValue="$USE_SPOT" \
            ParameterKey=OperatorIp,ParameterValue="$OPERATOR_CIDR" \
            ParameterKey=OperatorIpVersion,ParameterValue="$IP_VERSION" \
            ParameterKey=KeyName,ParameterValue="$KEY_NAME" \
            ParameterKey=AmiId,ParameterValue="$AMI_ID" \
            ParameterKey=ShutdownMinutes,ParameterValue="$SHUTDOWN_MINUTES" \
            ParameterKey=KalshiKeyId,ParameterValue="$KEY_ID" \
            ParameterKey=KalshiPrivateKey,ParameterValue="$PRIVATE_KEY_CONTENT" \
            ParameterKey=S3RecordingsBucket,ParameterValue="$RECORDINGS_BUCKET" \
            ParameterKey=EnvContent,ParameterValue="$ENV_CONTENT" \
            ParameterKey=RequirementsContent,ParameterValue="$REQUIREMENTS_CONTENT"
    
    echo "Waiting for stack creation to finish..."
    aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$REGION" || true
else
    aws cloudformation deploy \
        --template-file "$TMP_TEMPLATE" \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --parameter-overrides \
            Environment="$ENV" \
            InstanceTypeOverride="$INSTANCE_TYPE" \
            UseSpot="$USE_SPOT" \
            OperatorIp="$OPERATOR_CIDR" \
            OperatorIpVersion="$IP_VERSION" \
            KeyName="$KEY_NAME" \
            AmiId="$AMI_ID" \
            ShutdownMinutes="$SHUTDOWN_MINUTES" \
            KalshiKeyId="$KEY_ID" \
            KalshiPrivateKey="$PRIVATE_KEY_CONTENT" \
            S3RecordingsBucket="$RECORDINGS_BUCKET" \
            EnvContent="$ENV_CONTENT" \
            RequirementsContent="$REQUIREMENTS_CONTENT" \
        --s3-bucket "$S3_BUCKET" \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset
fi

PROVISION_END_TIME=$(date +%s)
PROVISION_DURATION=$((PROVISION_END_TIME - PROVISION_START_TIME))


rm "$TMP_TEMPLATE"


# --- 3. Get Outputs ---
echo "[3/4] Deployment complete. Fetching details..."



INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
    --output text)

PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicIp`].OutputValue' \
    --output text)

echo "--------------------------------------------------------"
echo "Done! Kalshi Worker is active at $PUBLIC_IP:8090"
echo "Instance ID: $INSTANCE_ID"
echo "Environment: $ENV (Managed by systemd)"
echo "Provisioning Time: $PROVISION_DURATION seconds"
echo "--------------------------------------------------------"
echo "To check server status:"
echo "ssh -i \"$SSH_KEY_PATH\" ec2-user@$PUBLIC_IP 'systemctl status kalshi'"
echo ""
echo "To view logs:"
echo "ssh -i \"$SSH_KEY_PATH\" ec2-user@$PUBLIC_IP 'journalctl -u kalshi -f'"
echo ""
echo "To delete stack:"
echo "aws cloudformation delete-stack --region \"$REGION\" --stack-name \"$STACK_NAME\""
echo "--------------------------------------------------------"

$BUN run lib/telegram.js --message "Kalshi worker launched! (Scheduled for ${SHUTDOWN_MINUTES}m)" --channel info