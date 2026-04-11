#!/bin/bash
# delete-iam-roles.sh - Surgical cleanup of IAM roles and stacks associated with terminated EC2 instances.

REGION="${REGION:-us-east-1}"
PREFIX="kalshi-worker-"

echo "Checking for CloudFormation stacks with prefix '$PREFIX' in $REGION..."

# List all stacks with the prefix that are not already being deleted
STACKS=$(aws cloudformation describe-stacks \
    --region "$REGION" \
    --query "Stacks[?starts_with(StackName, \`$PREFIX\`) && StackStatus!=\`DELETE_COMPLETE\` && StackStatus!=\`DELETE_IN_PROGRESS\`].StackName" \
    --output text)

if [ -z "$STACKS" ] || [ "$STACKS" == "None" ]; then
    echo "No matching stacks found."
    exit 0
fi

for stack in $STACKS; do
    echo "Processing stack: $stack"
    
    # Get the InstanceId from the stack resources
    INSTANCE_ID=$(aws cloudformation describe-stack-resources \
        --stack-name "$stack" \
        --region "$REGION" \
        --query "StackResources[?ResourceType==\`AWS::EC2::Instance\`].PhysicalResourceId" \
        --output text)
    
    if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
        echo "  No instance found in stack $stack. Deleting stack..."
        aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
        continue
    fi

    # Check instance state
    STATE=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$REGION" \
        --query "Reservations[].Instances[0].State.Name" \
        --output text 2>/dev/null || echo "not-found")
    
    if [ "$STATE" == "terminated" ] || [ "$STATE" == "not-found" ] || [ -z "$STATE" ] ; then
        echo "  Instance $INSTANCE_ID is ${STATE:-not-visible}. Deleting stack $stack..."
        aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
    else
        echo "  Instance $INSTANCE_ID is $STATE. Keeping stack."
    fi
done

echo "Cleanup complete."
