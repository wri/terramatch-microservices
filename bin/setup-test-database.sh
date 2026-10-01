#!/bin/bash
set -e

# Each nx project that has a test target gets its own test database so that project test runs
# may happen in parallel without interfering with each other. The DB name is derived from the
# project name in jest/setup-jest.ts; keep the two in sync.
DB_PREFIX=terramatch_microservices_test
TEMPLATE_PROJECT=database

db_name() {
  echo "${DB_PREFIX}_${1//-/_}"
}

mysql_root() {
  docker compose exec -T mariadb mysql -h localhost -u root -proot "$@"
}

PROJECTS=$(npx nx show projects --with-target test --json=false)
TEMPLATE_DB=$(db_name $TEMPLATE_PROJECT)

# Drop every existing test DB (including the old single shared DB) and recreate them all empty.
EXISTING=$(mysql_root -N -e "show databases like '${DB_PREFIX}%'")
{
  for db in $EXISTING; do
    echo "drop database \`$db\`;"
  done
  for project in $PROJECTS; do
    db=$(db_name "$project")
    echo "create database \`$db\`;"
    echo "grant all on \`$db\`.* to 'wri'@'%';"
  done
} | mysql_root

# Sync the DB schema into the template DB
npx nx test $TEMPLATE_PROJECT --no-cloud --skip-nx-cache libs/database/src/lib/database.module.spec.ts

# Copy the synced schema into every other project's DB
SCHEMA=$(docker compose exec -T mariadb mysqldump -h localhost -u root -proot --no-data "$TEMPLATE_DB")
for project in $PROJECTS; do
  if [ "$project" != "$TEMPLATE_PROJECT" ]; then
    echo "$SCHEMA" | mysql_root "$(db_name "$project")"
  fi
done
