import json
import psycopg2

# Load JSON data into a DataFrame
with open("new2.json") as f:
    data = json.load(f)[3]

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
def recurseData(dir_or_file,parent_id=0):
    """Recurse through the data structure. Do the following:
    * Add an id field to each object.
    * Sum up dsize and asize based on children.
    * Add each node to the postgres database."""
    global ID

    is_dir = isinstance(dir_or_file, list)

    if is_dir:
        # This is a directory. The directory information is the first element in the list
        node = dir_or_file[0]
    else:
        # This is a file. We can just set the node equal to it.
        node = dir_or_file

    # Set default values for this node
    node.setdefault("dsize", 0)
    node.setdefault("asize", 0)
    node["id"] = ID
    node["parent_id"] = parent_id
    node["child_ids"] = []
    ID += 1

    if is_dir and len(dir_or_file) > 1:
        # Move through the children of the directory first. This ensures the children will have an ID and dsize.
        for child in dir_or_file[1:]:
            child = recurseData(child, parent_id=node["id"])

            # Add child information to this node
            node["asize"] += child["asize"]
            node["dsize"] += child["dsize"]
            node["child_ids"].append(child["id"])

    # Insert node into PostgreSQL
    cursor.execute(
        "INSERT INTO db (id, name, dsize, asize, parent_id, child_ids) VALUES (%s, %s, %s, %s, %s, %s)",
        (node["id"], node["name"], node["dsize"], node["asize"], node["parent_id"], node["child_ids"])
    )

    return node

recurseData(data)

# Commit and close the connection
conn.commit()
cursor.close()
conn.close()
