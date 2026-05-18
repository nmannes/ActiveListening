#!/bin/bash

set -e

git pull || echo "git pull failed, continuing anyway"



# --- Configuration (Defaults) ---
BUN="/home/nathan/.bun/bin/bun"
REGION="${REGION:-us-east-1}"
KEY_NAME="${KEY_NAME:-us-east-1}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/$KEY_NAME.pem}"
LOCAL_DIR="$(pwd)"
REMOTE_USER="ubuntu"
REMOTE_DIR="/home/ubuntu"
AMI_ID="ami-04b70fa74e45c3917" # Ubuntu 24.04 LTS


DEPLOYED_IP_ADDRESS=""

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
FORCE=false


args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
    arg="${args[$i]}"
    case $arg in
        prod|demo) ENV=$arg ;;
        -f|--force) FORCE=true ;;
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
EXISTING_INSTANCES=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:Environment,Values=$ENV" "Name=instance-state-name,Values=running,pending" \
    --query 'Reservations[].Instances[].{ID:InstanceId, IP:PublicIpAddress}' \
    --output json)

COUNT=$(echo "$EXISTING_INSTANCES" | jq '. | length')

if [[ "$COUNT" -gt 0 ]]; then
    echo "--------------------------------------------------------"
    echo "ALREADY RUNNING: $COUNT $ENV instance(s) found:"
    echo "$EXISTING_INSTANCES" | jq -r '.[] | "  - \(.ID) at \(.IP)"'
    
    if [[ "$FORCE" == true ]]; then
        echo "FORCE ENABLED: Proceeding despite existing instance(s)."
        echo "--------------------------------------------------------"
    else
        echo "Aborting launch to avoid duplicates. Use -f to force."
        echo "--------------------------------------------------------"
        FIRST_IP=$(echo "$EXISTING_INSTANCES" | jq -r '.[0].IP')
        FIRST_ID=$(echo "$EXISTING_INSTANCES" | jq -r '.[0].ID')
        $BUN run lib/telegram.js --message "Aborted launch: A $ENV instance is already active at $FIRST_IP ($FIRST_ID)" --channel info
        exit 0
    fi
fi

# --- 1. Get Local IP and Credentials ---
echo "[1/4] Gathering deployment context..."
MY_IPV4=$(curl -4 -s https://ifconfig.me || true)
MY_IPV6=$(curl -6 -s https://ifconfig.me || true)

OPERATOR_IPV4=""
if [[ -n "$MY_IPV4" ]]; then
    OPERATOR_IPV4="${MY_IPV4}/32"
fi

if [[ -n "$MY_IPV6" ]]; then
    OPERATOR_IPV6="${MY_IPV6}/128"
fi

ASSIGN_IPV6="false"
TARGET_SUBNET=""
if [[ -n "$OPERATOR_IPV6" ]]; then
    # Find a default subnet in the region that has IPv6 associated
    IPV6_SUBNET=$(aws ec2 describe-subnets --region "$REGION" --filters "Name=default-for-az,Values=true" --query 'Subnets[?Ipv6CidrBlockAssociationSet[0].Ipv6CidrBlock != `null`].SubnetId' --output text | awk '{print $1}')
    if [[ -n "$IPV6_SUBNET" ]]; then
        ASSIGN_IPV6="true"
        TARGET_SUBNET="$IPV6_SUBNET"
        echo "Found IPv6-capable default subnet: $TARGET_SUBNET"
    else
        echo "Warning: Operator has IPv6, but no default subnets in $REGION support IPv6. Disabling instance IPv6 assignment."
    fi
fi

# Discover VpcId (required for Security Group if using SubnetId)
if [[ -n "$TARGET_SUBNET" ]]; then
    VPC_ID=$(aws ec2 describe-subnets --region "$REGION" --subnet-ids "$TARGET_SUBNET" --query 'Subnets[0].VpcId' --output text)
else
    VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
fi
echo "Using VPC: $VPC_ID"

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


# --- 2. Assemble and Launch Stack ---
echo "[2/4] Assembling and deploying modular CloudFormation stack..."
STACK_NAME="kalshi-worker-$RUN_ID"
if [[ "$FORCE" == true ]]; then
    STACK_NAME="${STACK_NAME}-forced"
fi

# Blueprint assembly via Jinja2
BLUEPRINT_DIR="$LOCAL_DIR/ec2-instance"
TMP_TEMPLATE="/tmp/assembled_template.yaml"

python3 "$BLUEPRINT_DIR/render_template.py" "$BLUEPRINT_DIR" "template.yaml.j2" "$TMP_TEMPLATE" --env "$ENV"

# S3 bucket for template deployment (required for templates > 51KB)
S3_BUCKET="deploys"

PROVISION_START_TIME_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

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
    
    echo "Parameters:"
    echo "  Environment: $ENV"
    echo "  InstanceType: $INSTANCE_TYPE"
    echo "  UseSpot: $USE_SPOT"
    echo "  OperatorIp: $OPERATOR_CIDR"
    echo "  KeyName: $KEY_NAME"
    echo "  AmiId: $AMI_ID"
    echo "  ShutdownMinutes: $SHUTDOWN_MINUTES"
    echo "--------------------------------------------------------"

    # Create a temporary JSON file for parameters to handle special characters/newlines robustly
    PARAMS_JSON_FILE="/tmp/stack_params_$RUN_ID.json"
    jq -n \
        --arg env "$ENV" \
        --arg inst "$INSTANCE_TYPE" \
        --arg spot "$USE_SPOT" \
        --arg ipv4 "$OPERATOR_IPV4" \
        --arg ipv6 "$OPERATOR_IPV6" \
        --arg key "$KEY_NAME" \
        --arg ami "$AMI_ID" \
        --arg shutdown "$SHUTDOWN_MINUTES" \
        --arg kid "$KEY_ID" \
        --arg pkey "$PRIVATE_KEY_CONTENT" \
        --arg s3 "$RECORDINGS_BUCKET" \
        --arg envc "$ENV_CONTENT" \
        --arg a6 "$ASSIGN_IPV6" \
        --arg subnet "$TARGET_SUBNET" \
        --arg vpc "$VPC_ID" \
        '[
            {ParameterKey: "Environment", ParameterValue: $env},
            {ParameterKey: "InstanceTypeOverride", ParameterValue: $inst},
            {ParameterKey: "UseSpot", ParameterValue: $spot},
            {ParameterKey: "OperatorIpv4", ParameterValue: $ipv4},
            {ParameterKey: "OperatorIpv6", ParameterValue: $ipv6},
            {ParameterKey: "KeyName", ParameterValue: $key},
            {ParameterKey: "AmiId", ParameterValue: $ami},
            {ParameterKey: "ShutdownMinutes", ParameterValue: $shutdown},
            {ParameterKey: "KalshiKeyId", ParameterValue: $kid},
            {ParameterKey: "KalshiPrivateKey", ParameterValue: $pkey},
            {ParameterKey: "S3RecordingsBucket", ParameterValue: $s3},
            {ParameterKey: "EnvContent", ParameterValue: $envc},
            {ParameterKey: "AssignIpv6Address", ParameterValue: $a6},
            {ParameterKey: "SubnetId", ParameterValue: $subnet},
            {ParameterKey: "VpcId", ParameterValue: $vpc}
        ]' > "$PARAMS_JSON_FILE"

    DEPLOYMENT_RESULTS=$( \
        aws cloudformation create-stack \
            --template-body "file://$TMP_TEMPLATE" \
            --stack-name "$STACK_NAME" \
            --region "$REGION" \
            --on-failure DO_NOTHING \
            --capabilities CAPABILITY_IAM \
            --parameters "file://$PARAMS_JSON_FILE" \
    )
    
    echo "Waiting for stack creation to finish (tailing events)..."
    while true; do
        STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
        
        # Clear screen or just print updates? Let's just print updates.
        # We query for events newer than our start time.
        aws cloudformation describe-stack-events --stack-name "$STACK_NAME" --region "$REGION" \
            --query "StackEvents[?Timestamp >= '$PROVISION_START_TIME_ISO'].{Time:Timestamp, Resource:LogicalResourceId, Status:ResourceStatus, Reason:ResourceStatusReason}" \
            --output table
            
        if [[ "$STATUS" == *"_COMPLETE" ]] || [[ "$STATUS" == *"_FAILED" ]]; then
            echo "Stack creation finished with status: $STATUS"
            break
        fi
        sleep 10
    done
else
    DEPLOYMENT_RESULTS=$( \
        aws cloudformation deploy \
        --template-file "$TMP_TEMPLATE" \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --parameter-overrides \
            Environment="$ENV" \
            InstanceTypeOverride="$INSTANCE_TYPE" \
            UseSpot="$USE_SPOT" \
            OperatorIpv4="$OPERATOR_IPV4" \
            OperatorIpv6="$OPERATOR_IPV6" \
            KeyName="$KEY_NAME" \
            AmiId="$AMI_ID" \
            ShutdownMinutes="$SHUTDOWN_MINUTES" \
            KalshiKeyId="$KEY_ID" \
            KalshiPrivateKey="$PRIVATE_KEY_CONTENT" \
            S3RecordingsBucket="$RECORDINGS_BUCKET" \
            EnvContent="$ENV_CONTENT" \
            AssignIpv6Address="$ASSIGN_IPV6" \
            SubnetId="$TARGET_SUBNET" \
            VpcId="$VPC_ID" \
        --s3-bucket "$S3_BUCKET" \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset \
    )
fi


PROVISION_END_TIME=$(date +%s)
# Note: PROVISION_START_TIME is not set anymore in seconds, so we recreate it or just use end-start if we care.
# Let's just set PROVISION_START_TIME_SEC for the duration calculation.
PROVISION_START_TIME_SEC=$(date -d "$PROVISION_START_TIME_ISO" +%s)
PROVISION_DURATION=$((PROVISION_END_TIME - PROVISION_START_TIME_SEC))


rm "$TMP_TEMPLATE"
[ -f "$PARAMS_JSON_FILE" ] && rm "$PARAMS_JSON_FILE"


# --- 3. Get Outputs ---
echo "[3/4] Deployment complete. Fetching details..."

echo "results:\n$DEPLOYMENT_RESULTS"

echo "--------------------------"

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
echo "ssh -i \"$SSH_KEY_PATH\" ubuntu@$PUBLIC_IP 'systemctl status kalshi'"
echo ""
echo "To view logs:"
echo "ssh -i \"$SSH_KEY_PATH\" ubuntu@$PUBLIC_IP 'journalctl -u kalshi -f'"
echo ""
echo "To delete stack:"
echo "aws cloudformation delete-stack --region \"$REGION\" --stack-name \"$STACK_NAME\""
echo "--------------------------------------------------------"

echo "[4/4] Generating and syncing audio-library to remote instance..."
python3 "$LOCAL_DIR/scripts/build_audio_library.py"

rsync -avz -e "ssh -i \"$SSH_KEY_PATH\" -o StrictHostKeyChecking=no" \
    "$LOCAL_DIR/audio-library/" \
    "$REMOTE_USER@$PUBLIC_IP:$REMOTE_DIR/kalshi/audio-library/"

$BUN run lib/telegram.js --message "Kalshi worker launched! (Scheduled for ${SHUTDOWN_MINUTES}m)" --channel info