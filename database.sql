-- Create table for the database entries
CREATE TABLE db (
    ID INT PRIMARY KEY,
    name VARCHAR(100),
    dsize BIGINT,
    asize BIGINT,
    parent_ID INT,
    child_IDs INT[]
);

-- Create function to query data
CREATE OR REPLACE FUNCTION get_child_as_json(input_id INT, level INT, max_level INT)
RETURNS jsonb as 
$$
DECLARE
	result jsonb;
BEGIN
   IF level < max_level THEN
     -- Aggregate the IDs that match the input array
     SELECT to_jsonb(rows)
     INTO result
     FROM 
     (
      SELECT m.*, (
        SELECT jsonb_agg(get_child_as_json(child, level+1, max_level))
         FROM UNNEST(m.child_ids) AS child
      ) AS children
       FROM db m
       WHERE m.id = input_id
     ) AS rows;
  ELSE
    SELECT to_jsonb(rows)
    INTO result
    FROM (
      SELECT m.*, array[]::integer[] AS children
      FROM db m
      WHERE m.id = input_id
    ) as rows;
  END IF;

  RETURN result;
END;
$$
LANGUAGE plpgsql;

