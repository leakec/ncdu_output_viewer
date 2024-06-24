import json
import pandas as pd
import psycopg2

# Load JSON data into a DataFrame
with open("new.json") as f:
    data = json.load(f)

# Connect to PostgreSQL
conn = psycopg2.connect(
    dbname="database",
    user="leake",
    password="",
    host="localhost",
    port=8079,
)
cursor = conn.cursor()

ID = 0
def recurseData(node,parent_id=0):
    """Recurse through the data structure. Do the following:
    * Add an id field to each object.
    * Sum up dsize and asize based on children.
    * Add each node to the postgres database."""
    global ID

    # Set default values for this node
    node.setdefault("dsize", 0)
    node.setdefault("asize", 0)
    node["id"] = ID
    node["parent_id"] = parent_id
    node["child_ids"] = []
    ID += 1

    # Move through all children first. This ensures
    # the children will have an ID and dsize.
    for child in node.get("children", []):
        recurseData(child, parent_id=node["id"])
        node["asize"] += child["asize"]
        node["dsize"] += child["dsize"]
        node["child_ids"].append(child["id"])

    # Insert DataFrame to PostgreSQL
    cursor.execute(
        "INSERT INTO db (id, name, dsize, asize, parent_id, child_ids) VALUES (%s, %s, %s, %s, %s, %s)",
        (node["id"], node["name"], node["dsize"], node["asize"], node["parent_id"], node["child_ids"])
    )

recurseData(data)

# Commit and close the connection
conn.commit()
cursor.close()
conn.close()
