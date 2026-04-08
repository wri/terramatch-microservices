#!/bin/bash

ENVS=("local" "dev" "test" "staging" "prod")
COMMANDS=("up" "down" "pending")

usage() {
  echo "Run or check status on migrations in local or remote environments."
  echo
  echo "Usage: $0 [-e env] <command>"
  echo "  -e: Environment to run command in. Options are: ${ENVS[*] }. Default is 'local'"
  echo
  echo "Commands: "
  echo "  up: Run all pending migrations"
  echo "  down: Roll back the most recent migration"
  echo "  pending: List pending migrations"
  echo
  echo "For additional control over migration work, use the standard REPL and the 'umzug' instance available there."
  exit "${1:-0}"
}

declare env="local"
declare command
while getopts ":e:h" opt; do
  case $opt in
    h)
      usage
      ;;
    e)
      env="$OPTARG"
      ;;
    \?)
      echo -e "Invalid Option: -$OPTARG\n"
      usage 1
      ;;
  esac
done

shift $((OPTIND-1))
command="$1"

if [[ " ${ENVS[*]} " != *" $env "* ]]; then echo -e "Invalid env: $env\n"; usage 1; fi
if [[ "$command" = "" ]]; then echo -e "Command missing\n"; usage 1; fi
if [[ " ${COMMANDS[*]} " != *" $command "* ]]; then echo -e "Invalid command: $command\n"; usage 1; fi

echo "Running migrate ${command} in ${env}";

tm-v3-cli repl --script "await umzug.${command}()" user-service "$env"
