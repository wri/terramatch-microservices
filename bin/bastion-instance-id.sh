#!/bin/bash

aws ec2 describe-instances --filters "Name=tag:Name,Values=wri-terramatch-staging-geoserver" --query "Reservations[].Instances[].InstanceId" --output text
