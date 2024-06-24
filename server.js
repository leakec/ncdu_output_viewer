const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure the PostgreSQL connection pool
const pool = new Pool({
  user: 'leake',
  host: 'localhost',
  database: 'database',
  password: '',
  port: 8079, // Default PostgreSQL port
});

// Endpoint to get a node and its three levels of children
app.get('/node/:id', async (req, res) => {
  const nodeId = parseInt(req.params.id, 10);
const query_func = `
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
`

const query = `
SELECT get_child_as_json($1, 0, 2)
`

  try {
    await pool.query(query_func);
    const result = await pool.query(query, [nodeId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
