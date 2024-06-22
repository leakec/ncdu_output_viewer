CREATE TABLE db (
  id INT,
  child_ids INT[],
  parent INT
);
INSERT INTO db (id, child_ids, parent)
VALUES
(0, '{1, 2}', 0), (1, '{3, 4}', 0), (2, '{}', 0), (3, '{}', 1), (4, '{}', 1);


CREATE OR REPLACE FUNCTION getVals() RETURNS SETOF db AS $$
SELECT * FROM db;
$$ LANGUAGE plpgsql;
SELECT * FROM getVals()
