#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:?Usage: $0 <slug>}"
REGION="us-east-1"

# Find the running EC2 instance tagged with this event slug
INSTANCE_JSON=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters \
        "Name=tag:Event,Values=$SLUG" \
        "Name=instance-state-name,Values=running,pending" \
    --query "Reservations[*].Instances[*].[InstanceId,Tags[?Key=='Name'].Value|[0]]" \
    --output json)

if [ -z "$INSTANCE_JSON" ] || [ "$INSTANCE_JSON" = "[]" ] || [ "$INSTANCE_JSON" = "[[]]" ]; then
    echo "No running EC2 instance found for '$SLUG'" >&2
    exit 1
fi

# Extract instance ID and stack name (first result)
PAIR=$(echo "$INSTANCE_JSON" | jq -r '.[0][0] | @tsv')
INSTANCE_ID=$(echo "$PAIR" | cut -f1)
STACK_NAME=$(echo "$PAIR" | cut -f2)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
    echo "No running EC2 instance found for '$SLUG'" >&2
    exit 1
fi

if [ -z "$STACK_NAME" ] || [ "$STACK_NAME" = "null" ]; then
    echo "Instance $INSTANCE_ID missing Name tag" >&2
    exit 1
fi

echo "Found instance $INSTANCE_ID in stack $STACK_NAME"

# Delete the CloudFormation stack (destroys the EC2 instance and all associated resources)
aws cloudformation delete-stack \
    --region "$REGION" \
    --stack-name "$STACK_NAME"

echo "Stack '$STACK_NAME' deletion initiated"
