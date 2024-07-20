mod cli;

use serde::{Deserialize, Serialize};
use serde_json::{Result, Value, from_value};
use std::path::PathBuf;
use std::fs::read_to_string;
use std::sync::{Arc, Mutex};
use postgres::{Client, NoTls};
use std::sync::atomic::{AtomicUsize, Ordering};
use humansize::{format_size, BINARY};

use std::fs::File;
use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom};

#[macro_use]
extern crate lazy_static;

#[derive(Serialize, Deserialize, Debug)]
struct DataNode {
    name: String,
    #[serde(default = "default_u64_zero")]
    asize: u64,
    #[serde(default = "default_u64_zero")]
    dsize: u64,
    #[serde(default = "default_bool_false")]
    leaf: bool,
}

fn default_u64_zero() -> u64 {
    0
}
fn default_bool_false() -> bool {
    false 
}

// Define a recursive enum to represent either a DataType or a nested array
#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum Node {
    Data(DataNode),
    Array(Vec<Node>),
}

static DIRS_ONLY: bool = true;
static ID: AtomicUsize = AtomicUsize::new(0);
lazy_static! {
    static ref PG: Arc<Mutex<Client>> = Arc::new(Mutex::new(Client::connect("postgresql://leake:@localhost/database", NoTls).unwrap()));
}

fn insert_data_pg(node: &DataNode, node_id: &usize, parent_id: usize, child_ids: &Vec<usize>)
{
    let dsize_h = format_size(node.dsize, BINARY);
    let asize_h = format_size(node.asize, BINARY);

    let query = format!(
        "INSERT INTO db (id, name, dsize, asize, dsize_h, asize_h, leaf, parent_id, child_ids) VALUES ('{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}')",
        node_id,
        node.name,
        node.dsize,
        node.asize,
        dsize_h,
        asize_h,
        node.leaf,
        parent_id,
        format!("{{{}}}", child_ids.iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
            .join(", "))
    );
    let mut pg = PG.lock().unwrap();
    let _ = pg.batch_execute(query.as_str());
}

fn recurse_data(dir_or_file: &mut Node, parent_id: usize) -> usize {
    let node_id = ID.fetch_add(1, Ordering::SeqCst);
    match dir_or_file {
        Node::Data(node) => {
            // This is a file
            node.leaf = true;
            if !DIRS_ONLY
            {
                insert_data_pg(node, &node_id, parent_id, &[].to_vec());
            }
            return node_id;
        },
        Node::Array(arr) => {
            // This is a directory. Get the node for the directory.
            let (dark, children) = arr.split_first_mut().unwrap();
            let node = match dark {
                Node::Data(data) => data,
                _ => panic!{"First node is not a data node!"},
            };

            // Recurse through the children. Adding up the size
            // as we go.
            let mut child_dsizes: Vec<u64> = [].to_vec();
            let mut child_ids: Vec<usize> = [].to_vec();

            for child in children {
                let child_id = recurse_data(child, node_id);
                match child {
                    Node::Data(data) => {
                        // This is a file. Only add it as a child if we are not doing dirs_only.
                        node.asize += data.asize;
                        node.dsize += data.dsize;
                        if !DIRS_ONLY {
                            child_ids.push(child_id);
                            child_dsizes.push(data.dsize);
                        }
                    },
                    Node::Array(arr) => match &arr[0] {
                        Node::Data(data) => {
                            node.asize += data.asize;
                            node.dsize += data.dsize;
                            child_ids.push(child_id);
                            child_dsizes.push(data.dsize);
                        },
                        _ => panic!{"First node is not a data node!"},
                    }
                }
            }

            // Sort the children by dsize
            let mut combined: Vec<_> = child_ids.iter().zip(child_dsizes.iter()).collect();
            combined.sort_by_key(|&(_, key)| key);
            child_ids = combined.iter().map(|&(val, _)| *val).collect();
            child_ids.reverse();

            match child_ids.len() {
                0 => node.leaf = true,
                _ => node.leaf = false
            };

            // Add node to PG
            insert_data_pg(node, &node_id, parent_id, &child_ids);

            return node_id;
        }
    };
}

fn get_data(file: &PathBuf) -> Node
{
    let fs = File::open(file).unwrap();
    
    // Create a buffered reader
    let mut reader = BufReader::new(fs);
    
    // Read lines until we reach the second line
    let mut buffer = String::new();
    reader.read_line(&mut buffer).unwrap(); // Read the first line
    buffer.clear();
    let start_pos = reader.stream_position().unwrap(); // Get the position after the first line
    
    // Seek to the start position of the second line
    reader.seek(SeekFrom::Start(start_pos)).unwrap();
    
    // Read the rest of the file into a string
    let mut content = String::new();
    reader.read_to_string(&mut content).unwrap();
    
    // Remove characters from the end up to ]
    if !content.is_empty() {
        for _ in 1..100 {
            let a = content.pop().unwrap();
            if a == ']' {
                break;
            }
        }
    }

   return serde_json::from_str(content.as_str()).unwrap();
}

fn build_database(file: &PathBuf) {
    let mut data: Node = get_data(file);

    recurse_data(&mut data, 0);
}

fn main() {
    let matches = cli::build_cli().get_matches();
    match matches.get_one::<String>("file") {
        Some(file) => build_database(&PathBuf::from(file)),
        _ => panic!{"No file specified"},
    };
}
