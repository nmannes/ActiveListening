#!/bin/bash
# discover_instance.sh — Dynamically finds the public IP of a running Kalshi worker instance

REGION="${REGION:-us-east-1}"
# We look for instances with the 'Kalshi-Worker' Name tag prefix that are running
# and specifically of type g6.large or g6.xlarge

FILTER_NAME="Name=tag:Name,Values=kalshi-worker-*"
FILTER_INSTANCE_TYPE="Name=instance-type,Values=g6.large,g6.xlarge,a1.xlarge"
FILTER_STATE="Name=instance-state-name,Values=running"

PUBLIC_IP=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "$FILTER_NAME" "$FILTER_INSTANCE_TYPE" "$FILTER_STATE" \
    --query 'Reservations[].Instances[0].PublicIpAddress' \
    --output text)

if [[ "$PUBLIC_IP" == "None" ]] || [[ -z "$PUBLIC_IP" ]]; then
    exit 1
fi

echo "$PUBLIC_IP"
