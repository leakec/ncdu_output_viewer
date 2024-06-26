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
    SELECT * from CHILD
    ROW_TO_JSON(child)
END;
'
LANGUAGE plpgsql;
SELECT m.*, get_row_by_id(array[1,2]) as children
FROM db m 
WHERE m.id = 0


-- Stuff from other computer
, (1, 0, '{3,4}'), (2,0,'{}'), (3, 1, '{}'), (4, 1, '{}')

CREATE TABLE db
(
  id int,
  parent int,
  child  int[]
);

INSERT INTO db(id, parent, child)
VALUES (0, 0, '{1, 2}'), (1, 0, '{3,4}'), (2,0,'{}'), (3, 1, '{}'), (4, 1, '{}')




with children as (
  SELECT t.* 
  FROM db t
  WHERE t.parent = 1
  ),
json_children as (
  SELECT row_to_json(children)
  FROM children
  )
SELECT m.*, 3 as children
FROM db m
WHERE m.id = 1;



SELECT m.id, jsonb_agg(c) as children
FROM db m
JOIN db c ON c.id = ANY(m.child)
WHERE m.id = 1
GROUP BY m.id




WITH RECURSIVE node_tree AS (
  SELECT *, 1 AS level
  FROM db
  WHERE id = 0
  
  UNION ALL
                                                       
  SELECT c.*, p.level + 1 AS level
  FROM db c
  JOIN node_tree p ON c.id = ANY(p.child)
   WHERE p.level < 2
)
SELECT m.id, jsonb_agg(c) as children
FROM node_tree m
JOIN node_tree c ON c.id = ANY(m.child)
WHERE m.id = 0
GROUP BY m.id


-- Working!
CREATE OR REPLACE FUNCTION get_child_as_json(input_id INT)
RETURNS jsonb as 
'
DECLARE
	result jsonb;
BEGIN
   -- Aggregate the IDs that match the input array
   SELECT to_jsonb(rows)
   INTO result
   FROM 
   (
     SELECT m.*, (
       SELECT jsonb_agg(get_child_as_json(child)) 
       FROM UNNEST(m.child_ids) AS child
     ) AS children
     FROM db m
     WHERE m.id = input_id
   ) AS rows;

    RETURN result;
END;
'
LANGUAGE plpgsql;
SELECT get_child_as_json(0)




CREATE OR REPLACE FUNCTION get_child_as_json(input_id INT, level INT, level_max INT)
RETURNS jsonb as 
'
DECLARE
	result jsonb;
BEGIN
   IF level < level_max THEN
     -- Aggregate the IDs that match the input array
     SELECT to_jsonb(rows)
     INTO result
     FROM 
     (
       SELECT m.*, (
         SELECT jsonb_agg(get_child_as_json(child)) 
         FROM UNNEST(m.child_ids) AS child
       ) AS children
       FROM db m
       WHERE m.id = input_id
     ) AS rows;
    END IF

    RETURN result;
END;
'
LANGUAGE plpgsql;
SELECT get_child_as_json(0)


-- Final product
CREATE OR REPLACE FUNCTION get_child_as_json(input_id INT, level INT, max_level INT)
RETURNS jsonb as 
'
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
      SELECT m.*, ''{}'' AS children
      FROM db m
      WHERE m.id = input_id
    ) as rows;
  END IF;

  RETURN result;
END;
'
LANGUAGE plpgsql;
SELECT get_child_as_json(0, 0, 2)
