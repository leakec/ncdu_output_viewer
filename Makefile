SRC_TS_FILES = $(wildcard ts/*.ts)
SRC_TS_FILES = $(wildcard ts/*.ts)
SRC_JS_FILES = ${SRC_TS_FILES:.ts=.js}

.PHONY: all clean pg

%.js : %.ts package.json
	yarn tsc -t es6 $<

package.json: 
	yarn init -p -y
	yarn add pg express typescript webpack d3 @types/d3 @types/node@20.0.0

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
	./start

clean: 
	rm -rf node_modules
	rm -f yarn.lock package.json
	rm -rf db
