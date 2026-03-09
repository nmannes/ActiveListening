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

# --- 0. Get Local IP ---
echo "[0/6] Getting local IP for whitelisting..."
MY_IP=$(curl -s https://ifconfig.me)
echo "Local IP: $MY_IP"
# AMI ID is now defaulted in CFN, but we keep the reference for clarity if needed
AMI_ID="ami-073d9221f657bc5ff" 
echo "Using AMI: $AMI_ID"

# --- 2. Launch Instance ---
echo "[2/6] Launching CloudFormation stack in $REGION (Spot: $USE_SPOT)..."
STACK_NAME="kalshi-worker-$RUN_ID"

aws cloudformation deploy \
    --template-file "$LOCAL_DIR/kalshi_gpu_server.yaml" \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --parameter-overrides \
        Environment="$ENV" \
        InstanceTypeOverride="$INSTANCE_TYPE_ARG" \
        UseSpot="$USE_SPOT" \
        OperatorIp="${MY_IP}/32" \
        KeyName="$KEY_NAME" \
        AmiId="$AMI_ID" \
        ShutdownMinutes="$SHUTDOWN_MINUTES"

# --- 3. Get Instance Details ---
echo "[3/6] Gathering instance details from stack..."

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

AZ=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`AvailabilityZone`].OutputValue' \
    --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP (AZ: $AZ)"
echo "$PUBLIC_IP" > remote_server_ip.txt

# --- 4. Wait for SSH

echo "Waiting for SSH to become ready..."
until nc -zvw3 "$PUBLIC_IP" 22 >/dev/null 2>&1; do
    printf "."
    sleep 2
done
echo " SSH is up!"

# --- 5. Sync Code ---
echo "[5/6] Syncing code to remote instance..."
# Ensure remote directory exists
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "mkdir -p $REMOTE_DIR"

# Explicitly list files to copy
FILES_TO_COPY=(
    "remote_server.py"
    "clip.py"
    ".env.demo"
    ".env.prod"
    "demo_private_key.txt"
    "prod_private_key.txt"
)

rsync -avz -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
    "${FILES_TO_COPY[@]}" \
    "$REMOTE_USER@$PUBLIC_IP:$REMOTE_DIR/"

# --- 6. Start Server ---
echo "[6/6] Starting server (cleaning up old processes first)..."
ssh -i "$SSH_KEY_PATH" $REMOTE_USER@$PUBLIC_IP "fuser -k 8090/tcp 2>/dev/null; sleep 1"
ssh -i "$SSH_KEY_PATH" $REMOTE_USER@$PUBLIC_IP "source ~/.cuda_env 2>/dev/null; export ENV=$ENV DEVICE=\$(test -x /usr/bin/nvidia-smi && echo cuda || echo cpu); cd ~; setsid python3 remote_server.py > logs/server.log 2>&1 < /dev/null & sleep 5; if pgrep -f 'python3 remote_server' > /dev/null; then echo SERVER_OK; tail -3 logs/server.log; else echo SERVER_FAILED; cat logs/server.log; exit 1; fi"

echo "--------------------------------------------------------"
echo "Done! Server is running at $PUBLIC_IP:8090"
echo "Environment: $ENV"
echo "Instance will automatically stop in 30 minutes."
echo "ssh -i \"$SSH_KEY_PATH\" $REMOTE_USER@$PUBLIC_IP"
echo "To stop manually: aws cloudformation delete-stack --region \"$REGION\" --stack-name \"$STACK_NAME\""
echo "Logs are available on remote at: ~/logs/server.log"
echo "--------------------------------------------------------"