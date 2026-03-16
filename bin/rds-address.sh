#!/bin/bash

aws rds describe-db-instances --db-instance-identifier wri-terramatch-$1 --query "DBInstances[0].[Endpoint.Address]" --output text
