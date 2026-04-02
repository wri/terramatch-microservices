#!/bin/bash

cat <<- SQL | docker compose exec -T mariadb mysql -h localhost -u root -proot
drop database if exists terramatch_microservices_test;
create database terramatch_microservices_test;
grant all on terramatch_microservices_test.* to 'wri'@'%';
SQL

# Sync the DB schema
nx test database --no-cloud --skip-nx-cache libs/database/src/lib/database.module.spec.ts

#  	echo "create database if not exists terramatch_test;" | docker compose exec -T mariadb mysql -h localhost -u root -proot
   #	echo "grant all on terramatch_test.* to 'wri'@'%';" | docker compose exec -T mariadb mysql -h localhost -u root -proot
