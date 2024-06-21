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
  const query = `
    WITH RECURSIVE node_tree AS (
      SELECT id, parent_id, name, 1 AS level
      FROM db
      WHERE id = $1

      UNION ALL

      SELECT c.id, c.parent_id, c.name, p.level + 1 AS level
      FROM db c
      JOIN node_tree p ON c.parent_id = p.id
      WHERE p.level < 3
    )
    SELECT *
    FROM node_tree;
  `;

  try {
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
