#!/bin/bash
# discover_instance.sh — Dynamically finds the public IP of a running Kalshi worker instance

REGION="${REGION:-us-east-1}"
FILTER_NAME="Name=tag:Name,Values=kalshi-worker-*"
FILTER_STATE="Name=instance-state-name,Values=running"

# Query for either IPv6 (preferred) or IPv4
IP=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "$FILTER_NAME" "$FILTER_STATE" \
    --query 'Reservations[].Instances[0].PublicIpAddress || Reservations[].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address' \
    --output text)

if [[ "$IP" == "None" ]] || [[ -z "$IP" ]]; then
    exit 1
fi

echo "$IP"
