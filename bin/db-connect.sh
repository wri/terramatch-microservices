#!/bin/bash

ENVS=("dev" "test" "staging" "prod")
DIR=$(dirname "$0")

usage() {
  echo -e "Port forward an AWS RDS DB connection through the bastion host.\n"
  echo "Usage: $0 [-p <local port>] [-f] [-t] env"
  echo "  -p: Local port to forward the RDS connection to. Default is 3311"
  echo "  -f: Forward the port only. The default behavior launches the MySQL client to connect to the DB."
  echo "  -t: Tabbed output when piping in an SQL script. By default, if a query is being piped in, the results will display in a table"
  echo "  env: Environment to connect to. Options are: ${ENVS[*] }"
  exit "${1:-0}"
}

tm_bastion_host() {
    "$DIR/bastion-instance-id.sh"
}

tm_rds_address() {
    "$DIR/rds-address.sh" "$1"
}

tm_db_password() {
    aws secretsmanager get-secret-value --secret-id db-admin-password-"$1" --query "SecretString" --output text
}

wait_for_port() {
    nc -z localhost "$1"
    local code=$?
    local waits=1
    until [ $code -eq 0 ]; do
        sleep 1
        ((waits++))
        if [ $waits -gt 15 ]; then
            echo "Timed out waiting for port $1"
            return $code
        fi

        nc -z localhost "$1"
        local code=$?
    done
}

declare env host address password
declare port=3311
declare forwardOnly=false
declare tabbed=false
while getopts ":p:fth" opt; do
  case $opt in
    h)
      usage
      ;;
    p)
      port="$OPTARG"
      ;;
    f)
      forwardOnly=true
      ;;
    t)
      tabbed=true
      ;;
    \?)
      echo -e "Invalid Option: -$OPTARG\n"
      usage 1
      ;;
  esac
done

shift $((OPTIND-1))
env="$1"

if [[ "$env" = "" ]]; then echo -e "Env missing\n"; usage 1; fi
if [[ " ${ENVS[*]} " != *" $env "* ]]; then echo -e "Invalid env: $env\n"; usage 1; fi

if ! host=$(tm_bastion_host); then echo "Getting bastion host failed"; exit 1; fi
if ! address=$(tm_rds_address "$1"); then echo "Getting RDS address failed"; exit 1; fi
if [ $forwardOnly = false ]; then
  if ! password=$(tm_db_password "$1"); then echo "Getting DB password failed"; exit 1; fi
fi

echo "Connection to RDS instance $address through bastion host $host"
ssh -N "ubuntu@$host" -L "$port:$address:3306" &
declare sshPid=$!

if ! wait_for_port "$port"; then exit $?; fi

if [ $forwardOnly = true ]; then
  echo "Press Ctrl+C to close connection"
  trap 'kill $sshPid; exit' SIGINT
  while true; do sleep 1; done
else
  declare format="--table"
  if [[ ! -t 0 && $tabbed = true ]]; then format="--batch"; fi
  MYSQL_PWD="$password" mysql -A -h localhost -P "$port" --protocol=TCP -u admin "$format" wri_restoration_marketplace
  kill $sshPid;
fi
