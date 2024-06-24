-- Connect to PostgreSQL using psql or any PostgreSQL client
-- CREATE DATABASE database;
-- -- -- \copy database from program 'sed -e ''s/\\/\\\\/g'' /home/leake/Downloads/ncdu_output_viewer/new.json';
-- -- 
-- \c database  -- Connect to the newly created database

CREATE TABLE db (
    ID INT PRIMARY KEY,
    name VARCHAR(100),
    dsize BIGINT,
    asize BIGINT,
    parent_ID INT,
    child_IDs INT[]
);
