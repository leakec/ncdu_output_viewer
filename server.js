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
});

// Endpoint to get a node and its three levels of children
app.get('/node/:id/:length', async (req, res) => {
  const nodeId = parseInt(req.params.id, 10);
  const length = parseInt(req.params.length, 10);

  const query = `
  SELECT get_child_as_json($1, 0, $2)
  `

  try {
    const result = await pool.query(query, [nodeId, length]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
