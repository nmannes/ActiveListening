#!/bin/bash
# update_ssh_ip.sh — Automatically updates AWS Security Group rules with the current public IP

set -e

REGION="${REGION:-us-east-1}"
ENV="${1:-demo}"

echo "Detecting current public IP..."
MY_IPV4=$(curl -s https://api.ipify.org || true)
MY_IPV6=$(curl -s https://api64.ipify.org || true)

if [[ -z "$MY_IPV4" && -z "$MY_IPV6" ]]; then
    echo "Error: Could not detect your public IP address."
    exit 1
fi

echo "Public IPv4: ${MY_IPV4:-None}"
echo "Public IPv6: ${MY_IPV6:-None}"

echo "Finding running $ENV instance in $REGION..."
INSTANCE_INFO=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:Environment,Values=$ENV" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].{Id:InstanceId, SG:SecurityGroups[0].GroupId}' \
    --output json)

INSTANCE_ID=$(echo "$INSTANCE_INFO" | jq -r '.Id')
SG_ID=$(echo "$INSTANCE_INFO" | jq -r '.SG')

if [[ "$INSTANCE_ID" == "null" ]]; then
    echo "Error: No running $ENV instance found."
    exit 1
fi

echo "Found instance $INSTANCE_ID with Security Group $SG_ID"

# Describing current rules to find old IPs
echo "Fetching current Security Group rules..."
RULES=$(aws ec2 describe-security-groups --region "$REGION" --group-ids "$SG_ID" --query 'SecurityGroups[0].IpPermissions[?ToPort==`22` || ToPort==`8090`]' --output json)

# Revoke old rules if they exist
echo "Revoking old access rules..."
echo "$RULES" | jq -c '.[]' | while read -r rule; do
    PORT=$(echo "$rule" | jq -r '.ToPort')
    echo "Processing rule for port $PORT..."
    
    # Revoke IPv4 ranges
    echo "$rule" | jq -c '.IpRanges[]' | while read -r range; do
        CIDR=$(echo "$range" | jq -r '.CidrIp')
        echo "Revoking IPv4 $CIDR for port $PORT..."
        aws ec2 revoke-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port "$PORT" --cidr "$CIDR" || true
    done
    
    # Revoke IPv6 ranges
    echo "$rule" | jq -c '.Ipv6Ranges[]' | while read -r range; do
        CIDR=$(echo "$range" | jq -r '.CidrIpv6')
        echo "Revoking IPv6 $CIDR for port $PORT..."
        aws ec2 revoke-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port "$PORT" --cidr-ipv6 "$CIDR" || true
    done
done

# Authorize new rules
echo "Authorizing current IP..."
if [[ -n "$MY_IPV4" ]] && [[ "$MY_IPV4" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Authorizing IPv4 ${MY_IPV4}/32 for ports 22 and 8090..."
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 22 --cidr "${MY_IPV4}/32"
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 8090 --cidr "${MY_IPV4}/32"
fi

if [[ -n "$MY_IPV6" ]] && [[ "$MY_IPV6" == *":"* ]]; then
    echo "Authorizing IPv6 ${MY_IPV6}/128 for ports 22 and 8090..."
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 22 --cidr-ipv6 "${MY_IPV6}/128"
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 8090 --cidr-ipv6 "${MY_IPV6}/128"
fi


echo "Successfully updated Security Group $SG_ID for instance $INSTANCE_ID"
