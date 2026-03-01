#!/bin/bash
# launch_gpu_server.sh — Automates AWS GPU instance for Kalshi transcription
# Launches G6 instance (L4 GPU), syncs code, runs server, and schedules 30m shutdown.

set -e

# --- Configuration ---
REGION="us-east-1"
SECURITY_GROUP="sg-0e12f54598d39a1f5" # Reusing your existing SG
KEY_NAME="us-east-1" 
SSH_KEY_PATH="$HOME/.ssh/us-east-1.pem" 
LOCAL_DIR="$(pwd)"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/kalshi"

# --- Subcommand: Destroy All ---
if [[ "$1" == "--destroy-all" ]]; then
    echo "Querying all instances in $REGION..."
    INSTANCE_IDS=$(aws ec2 describe-instances \
        --region "$REGION" \
        --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' \
        --output text)
    if [ -z "$INSTANCE_IDS" ]; then
        echo "No instances found to terminate."
    else
        echo "Terminating instances: $INSTANCE_IDS"
        aws ec2 terminate-instances --region "$REGION" --instance-ids $INSTANCE_IDS
    fi
    exit 0
fi

# --- Environment Setup ---
ENV=${1:-demo} 
if [[ "$ENV" != "prod" && "$ENV" != "demo" ]]; then
    echo "Usage: $0 [demo|prod|--destroy-all]"
    exit 1
fi

if [[ "$ENV" == "prod" ]]; then
    INSTANCE_TYPE="g6.xlarge"
else
    INSTANCE_TYPE="t3.micro"
fi

RUN_ID=$(cat /proc/sys/kernel/random/uuid | cut -d- -f1)
REMOTE_DIR="/home/ec2-user/kalshi"

echo "Deploying to environment: $ENV"

# --- 0. Whitelist Current IP (Ephemeral) ---
echo "[0/6] Ensuring local IP is whitelisted (All Traffic)..."
MY_IP=$(curl -s https://ifconfig.me)
echo "Local IP: $MY_IP"


# Attempt to authorize all traffic from current IP
aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SECURITY_GROUP" \
    --protocol -1 \
    --port all \
    --cidr "${MY_IP}/32" 2>/dev/null || echo "Rule already exists"

# --- 1. Use Basic AMI ---
echo "[1/6] Using basic Amazon Linux 2023 AMI..."
# Reusing the AMI from your aws_main_script.sh
AMI_ID="ami-0f3caa1cf4417e51b" 
echo "Using AMI: $AMI_ID"

# --- 2. Launch Instance ---
echo "[2/6] Launching $INSTANCE_TYPE in $REGION..."
RUN_INSTANCES=$(aws ec2 run-instances \
    --region "$REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --security-group-ids "$SECURITY_GROUP" \
    --key-name "$KEY_NAME" \
    --count 1 \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=Kalshi-Worker-$RUN_ID}]" \
    --metadata-options '{"HttpEndpoint":"enabled","HttpTokens":"required"}' \
    --query 'Instances[0].[InstanceId]' \
    --output text)

INSTANCE_ID=$(echo "$RUN_INSTANCES" | tail -n1)
echo "Instance ID: $INSTANCE_ID"

# --- 3. Wait for IP ---
echo "[3/6] Waiting for instance to start..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

# Get IP and AZ
DESCRIBE=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].{IP:PublicIpAddress,AZ:Placement.AvailabilityZone}' \
    --output json)

PUBLIC_IP=$(echo "$DESCRIBE" | jq -r '.IP')
AZ=$(echo "$DESCRIBE" | jq -r '.AZ')

echo "Public IP: $PUBLIC_IP (AZ: $AZ)"

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

# Rsync (excluding node_modules and logs to save time)
rsync -avz -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
    --exclude "node_modules" \
    --exclude "logs" \
    --exclude ".git" \
    --exclude "prod_private_key.txt" \
    "$LOCAL_DIR/" "$REMOTE_USER@$PUBLIC_IP:$REMOTE_DIR/"

# --- 6. Start Server & Schedule Shutdown ---
echo "[6/6] Starting server and scheduling auto-shutdown (30m)..."
ssh -i "$SSH_KEY_PATH" -f "$REMOTE_USER@$PUBLIC_IP" "bash -c '
    cd $REMOTE_DIR
    echo \"Scheduling shutdown in 30 minutes...\"
    sudo shutdown -h +30
    
    echo \"Installing dependencies (this takes a moment on base AMI)...\"
    # On a base AMI, we also need to install python3-pip and potentially drivers
    sudo dnf install -y python3-pip > /dev/null
    pip3 install -r requirements.txt 

    echo \"Launching remote_server.py in environment: $ENV...\"
    # Note: On a base AMI with no drivers, we fallback to CPU for testing
    DEVICE=\"cpu\"
    if command -v nvidia-smi &> /dev/null; then DEVICE=\"cuda\"; fi

    mkdir -p /home/ec2-user/kalshi/logs
    
    nohup python3 remote_server.py --env $ENV --device \$DEVICE --model base.en --logFile /home/ec2-user/kalshi/logs/app.log &
    echo \"Server started in background (\$DEVICE mode). Logs: /home/ec2-user/kalshi/logs/remote_gpu.log\"
'"

echo "--------------------------------------------------------"
echo "Done! Server is running at $PUBLIC_IP:8090"
echo "Environment: $ENV"
echo "Instance will automatically stop in 30 minutes."
echo "ssh -i \"$SSH_KEY_PATH\" $REMOTE_USER@$PUBLIC_IP"
echo "To stop manually: aws ec2 terminate-instances --instance-ids $INSTANCE_ID"
echo "--------------------------------------------------------"


