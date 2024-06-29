.PHONY: all clean pg

package.json: 
	yarn init -p -y
	yarn add pg express

db:
	mkdir -p db
	pg_ctl -D db init
	sed -i 's|#unix_socket_directories = '\''/var/run/postgresql, /tmp'\''|unix_socket_directories = '\'$(CURDIR)/db\''|g' db/postgresql.conf
	pg_ctl -D db start
	psql -h localhost -d postgres -c "CREATE DATABASE database;"
	psql -h localhost -d database -f database.sql
	python database.py
	pg_ctl -D db stop

all: package.json db
	pg_ctl -D db start
	node server.js

clean: 
	rm -rf node_modules
	rm -f yarn.lock package.json
	rm -rf db
