#!/bin/bash
# launch_gpu_server.sh — Automates AWS GPU instance for Kalshi transcription
# Launches G6 instance (L4 GPU), syncs code, runs server, and schedules 30m shutdown.

set -e

# --- Configuration (Defaults) ---
REGION="${REGION:-us-east-1}"
KEY_NAME="${KEY_NAME:-us-east-1}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/$KEY_NAME.pem}"
LOCAL_DIR="$(pwd)"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user"
AMI_ID="ami-0bbf3a5a5f8ea3603"


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
SHUTDOWN_MINUTES=30

args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
    arg="${args[$i]}"
    case $arg in
        prod|demo) ENV=$arg ;;
        --spot) USE_SPOT=true ;;
        --destroy-all) ENV="--destroy-all" ;;
        --shutdown-minutes) SHUTDOWN_MINUTES="${args[$((i+1))]}"; ((i++)) ;;
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
    INSTANCE_TYPE="g6.xlarge"
else
    INSTANCE_TYPE="t3.large"
fi

SPOT_OPTIONS=""
if [[ "$USE_SPOT" == true ]]; then
    SPOT_OPTIONS="--instance-market-options '{\"MarketType\": \"spot\"}'"
fi

RUN_ID=$(cat /proc/sys/kernel/random/uuid | cut -d- -f1)
REMOTE_DIR="/home/ec2-user"

echo "Deploying to environment: $ENV"

# --- 1. Get Local IP and Credentials ---
echo "[1/4] Gathering deployment context..."
MY_IP=$(curl -s https://ifconfig.me)
echo "Local IP: $MY_IP"

# Load credentials from local env file
ENV_FILE="$LOCAL_DIR/.env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file $ENV_FILE not found."
    exit 1
fi

KEY_ID=$(grep "KALSHI_KEY_ID" "$ENV_FILE" | cut -d= -f2 | xargs)
PRIVATE_KEY_PATH=$(grep "KALSHI_PRIVATE_KEY_PATH" "$ENV_FILE" | cut -d= -f2 | xargs)

# Resolve relative paths in .env
if [[ "$PRIVATE_KEY_PATH" == ./* ]]; then
    PRIVATE_KEY_PATH="$LOCAL_DIR/${PRIVATE_KEY_PATH#./}"
fi

if [ ! -f "$PRIVATE_KEY_PATH" ]; then
    echo "Error: Private key not found at $PRIVATE_KEY_PATH"
    exit 1
fi

PRIVATE_KEY_CONTENT=$(cat "$PRIVATE_KEY_PATH")

# --- 2. Assemble and Launch Stack ---
echo "[2/4] Assembling and deploying modular CloudFormation stack..."
STACK_NAME="kalshi-worker-$RUN_ID"

# Blueprint assembly via Jinja2
BLUEPRINT_DIR="$LOCAL_DIR/ec2-instance"
TMP_TEMPLATE="/tmp/assembled_template.yaml"

python3 "$BLUEPRINT_DIR/render_template.py" "$BLUEPRINT_DIR" "template.yaml.j2" "$TMP_TEMPLATE"

# S3 bucket for template deployment (required for templates > 51KB)
S3_BUCKET="deploys"

PROVISION_START_TIME=$(date +%s)

aws cloudformation deploy \
    --template-file "$TMP_TEMPLATE" \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --parameter-overrides \
        Environment="$ENV" \
        InstanceTypeOverride="$INSTANCE_TYPE_ARG" \
        UseSpot="$USE_SPOT" \
        OperatorIp="${MY_IP}/32" \
        KeyName="$KEY_NAME" \
        AmiId="$AMI_ID" \
        ShutdownMinutes="$SHUTDOWN_MINUTES" \
        KalshiKeyId="$KEY_ID" \
        KalshiPrivateKey="$PRIVATE_KEY_CONTENT" \
    --s3-bucket "$S3_BUCKET" \
    --capabilities CAPABILITY_IAM

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