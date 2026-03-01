#!/bin/bash
# destroy_all_instances.sh — Terminates all EC2 instances in us-east-1

set -e

REGION="us-east-1"

echo "Querying all instances in $REGION..."
INSTANCE_IDS=$(aws ec2 describe-instances \
    --region "$REGION" \
    --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' \
    --output text)

if [ -z "$INSTANCE_IDS" ]; then
    echo "No running/stopped instances found in $REGION."
    exit 0
fi

echo "The following instances will be terminated:"
echo "$INSTANCE_IDS"

read -p "Are you sure you want to terminate these instances? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    aws ec2 terminate-instances --region "$REGION" --instance-ids $INSTANCE_IDS
    echo "Termination signal sent."
else
    echo "Aborted."
fi
