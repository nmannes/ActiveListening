#!/bin/bash

aws configure

aws ec2 run-instances --image-id 'ami-0f3caa1cf4417e51b' --instance-type 't3.micro' --network-interfaces '{"AssociatePublicIpAddress":true,"DeviceIndex":0,"Groups":["sg-0e12f54598d39a1f5"]}' --credit-specification '{"CpuCredits":"unlimited"}' --metadata-options '{"HttpEndpoint":"enabled","HttpPutResponseHopLimit":2,"HttpTokens":"required"}' --private-dns-name-options '{"HostnameType":"ip-name","EnableResourceNameDnsARecord":true,"EnableResourceNameDnsAAAARecord":false}' --count '1' 