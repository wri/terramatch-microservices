#!/bin/sh

echo "Waiting for MariaDB..."
until docker-compose exec mariadb mysqladmin ping -hlocalhost -u root -proot --silent
do
  echo "MariaDB is not ready will retry in 5..."
  sleep 5
done

echo "MariaDB is ready"
