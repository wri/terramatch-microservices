# MARIADB
FROM mariadb:10.3 AS mariadb
COPY docker/override.cnf /etc/mysql/mariadb.conf.d/override.cnf
