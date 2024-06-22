CREATE TABLE db (
  id INT,
  child_ids INT[],
  parent INT
);
INSERT INTO db (id, child_ids, parent)
VALUES
(0, '{1, 2}', 0), (1, '{3, 4}', 0), (2, '{}', 0), (3, '{}', 1), (4, '{}', 1);


CREATE OR REPLACE FUNCTION get_row_by_id(input_id INT)
RETURNS SETOF db as 
'
BEGIN
    RETURN QUERY
    SELECT m.*
    FROM db m
    WHERE m.id = input_id;
END;
'
LANGUAGE plpgsql;
SELECT * FROM get_row_by_id(0)


-- In progress
CREATE OR REPLACE FUNCTION get_row_by_id(input_id INT[])
RETURNS JSON as 
'
BEGIN
    WITH child AS (
      SELECT c.*
      FROM db c
      WHERE c.id = ANY(input_id)
    )
    SELECT  from CHILD
    ROW_TO_JSON(child)
END;
'
LANGUAGE plpgsql;
SELECT m.*, get_row_by_id(array[1,2]) as children
FROM db m 
WHERE m.id = 0
