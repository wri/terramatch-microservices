#!/bin/bash

cd ../wri-terramatch-api
cat <<- SQL | docker-compose exec -T mariadb mysql -h localhost -u root -proot
drop database if exists terramatch_microservices_test;
create database terramatch_microservices_test;
grant all on terramatch_microservices_test.* to 'wri'@'%';
SQL

