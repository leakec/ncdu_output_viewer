mod cli;

use serde::{Deserialize, Serialize};
use serde_json::{Result, Value, from_value};
use std::path::PathBuf;
use std::fs::read_to_string;
use std::sync::{Arc, Mutex};
use postgres::{Client, NoTls};
use std::sync::atomic::{AtomicUsize, Ordering};
use humansize::{format_size, BINARY};

#[macro_use]
extern crate lazy_static;

#[derive(Serialize, Deserialize, Debug)]
struct DataNode {
    #[serde(default = "default_usize_zero")]
    id: usize,
    name: String,
    #[serde(default = "default_u64_zero")]
    asize: u64,
    #[serde(default = "default_u64_zero")]
    dsize: u64,
    #[serde(default = "default_string")]
    asize_h: String,
    #[serde(default = "default_string")]
    dsize_h: String,
    #[serde(default = "default_usize_zero")]
    parent_id: usize,
    #[serde(default = "default_vec_zero")]
    child_ids: Vec<usize>,
    #[serde(default = "default_bool_false")]
    leaf: bool,
}

fn default_u64_zero() -> u64 {
    0
}
fn default_usize_zero() -> usize {
    0
}
fn default_vec_zero() -> Vec<usize> {
    [].to_vec()
}
fn default_bool_false() -> bool {
    false 
}
fn default_string() -> String {
    String::new()
}

// Define a recursive enum to represent either a DataType or a nested array
#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum Node {
    Data(DataNode),
    Array(Vec<Node>)
}

static DIRS_ONLY: bool = true;
static ID: AtomicUsize = AtomicUsize::new(0);
lazy_static! {
    static ref PG: Arc<Mutex<Client>> = Arc::new(Mutex::new(Client::connect("postgresql://leake:@localhost/database", NoTls).unwrap()));
}

fn insert_data_pg(node: &DataNode)
{
    let query = format!(
        "INSERT INTO db (id, name, dsize, asize, dsize_h, asize_h, leaf, parent_id, child_ids) VALUES ('{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}')",
        node.id,
        node.name,
        node.dsize,
        node.asize,
        node.dsize_h,
        node.asize_h,
        node.leaf,
        node.parent_id,
        format!("{{{}}}", node.child_ids.iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
            .join(", "))
    );
    let mut pg = PG.lock().unwrap();
    let _ = pg.batch_execute(query.as_str());
}

fn recurse_data(dir_or_file: &mut Node, parent_id: usize) -> bool {
    match dir_or_file {
        Node::Data(node) => {
            // This is a file
            node.leaf = true;
            node.id = ID.fetch_add(1, Ordering::SeqCst);
            node.parent_id = parent_id;
            node.dsize_h = format_size(node.dsize, BINARY);
            node.asize_h = format_size(node.asize, BINARY);
            if !DIRS_ONLY
            {
                insert_data_pg(node);
            }
            return false;
        },
        Node::Array(arr) => {
            // This is a directory. Get the node for the directory.
            let (dark, children) = arr.split_first_mut().unwrap();
            let node = match dark {
                Node::Data(data) => data,
                _ => panic!{"First node is not a data node!"},
            };
            node.id = ID.fetch_add(1, Ordering::SeqCst);

            // Recurse through the children. Adding up the size
            // as we go.
            let mut child_dsizes: Vec<u64> = [].to_vec();

            for child in children {
                recurse_data(child, node.id);
                match child {
                    Node::Data(data) => {
                        // This is a file. Only add it as a child if we are not doing dirs_only.
                        node.asize += data.asize;
                        node.dsize += data.dsize;
                        if !DIRS_ONLY {
                            node.child_ids.push(data.id);
                            child_dsizes.push(data.dsize);
                        }
                    },
                    Node::Array(arr) => match &arr[0] {
                        Node::Data(data) => {
                            node.asize += data.asize;
                            node.dsize += data.dsize;
                            node.child_ids.push(data.id);
                            child_dsizes.push(data.dsize);
                        },
                        _ => panic!{"First node is not a data node!"},
                    }
                }
            }

            // Set the remaning node values
            node.parent_id = parent_id;
            node.dsize_h = format_size(node.dsize, BINARY);
            node.asize_h = format_size(node.asize, BINARY);

            // Sort the children by dsize
            let mut combined: Vec<_> = node.child_ids.iter().zip(child_dsizes.iter()).collect();
            combined.sort_by_key(|&(_, key)| key);
            node.child_ids = combined.iter().map(|&(val, _)| *val).collect();
            node.child_ids.reverse();

            match node.child_ids.len() {
                0 => node.leaf = true,
                _ => node.leaf = false
            };

            // Add node to PG
            insert_data_pg(node);

            return true;
        }
    };
}


fn build_database(file: &PathBuf) {
    let parsed: Result<Vec<Value>> = serde_json::from_str(read_to_string(file).unwrap().as_str());

    let mut data: Vec<Node> = match parsed {
        Ok(mut values) => {
            // Skip the first three values
            if values.len() > 3 {
                values.drain(0..3);
            }

            // Deserialize the remaining values as Vec<Node>
            match from_value(Value::Array(values))
            {
                Ok(val) => val,
                Err(e) => {panic!{"{}", e}}
            }
        },
        Err(e) => {panic!{"{}", e}}
    };
    recurse_data(&mut data[0], 0);
}

fn main() {
    let matches = cli::build_cli().get_matches();
    match matches.get_one::<String>("file") {
        Some(file) => build_database(&PathBuf::from(file)),
        _ => panic!{"No file specified"},
    };
}
