#!/bin/bash

ENVS=("dev" "test" "staging" "prod")

function rdsAddress() {
  aws rds describe-db-instances --db-instance-identifier wri-terramatch-"$1" --query "DBInstances[0].[Endpoint.Address]" --output text
}

function adminPassword() {
  aws secretsmanager get-secret-value --secret-id db-admin-password-"$1" --query "SecretString" --output text
}

function mysqlDumpToS3() {
  local env=$1
  if [[ " ${ENVS[*]} " != *" $env "* ]]; then
    echo "Invalid env: $env"
    return 1;
  fi

  declare address
  if ! address=$(rdsAddress "$env"); then
    echo "Getting RDS address failed for ${env}"
    return 1;
  fi

  declare password
  if ! password=$(adminPassword "$env"); then
    echo "Getting admin password failed for ${env}"
    return 1;
  fi

  MYSQL_PWD="$password" mysqldump -h "$address" -u admin wri_restoration_marketplace | aws s3 cp - s3://wri-tm-db-backup/"$env"/"$(date -I)-$env".sql
}

echo "Beginning dump: dev"
mysqlDumpToS3 dev
echo "Beginning dump: test"
mysqlDumpToS3 test
echo "Beginning dump: staging"
mysqlDumpToS3 staging
echo "Beginning dump: prod"
mysqlDumpToS3 prod
