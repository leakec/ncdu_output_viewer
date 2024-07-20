mod cli;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use postgres::{Client, NoTls};
use std::sync::atomic::{AtomicUsize, Ordering};
use humansize::{format_size, BINARY};

use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};

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

// Returns the DataNode, the ID of the DataNode, and is_file. If is_file is true,
// then the child is a file. If false, then it was a directory.
fn recurse_data(dir_or_file: Node, parent_id: usize) -> (DataNode, usize, bool) {
    let node_id = ID.fetch_add(1, Ordering::SeqCst);
    match dir_or_file {
        Node::Data(mut node) => {
            // This is a file
            node.leaf = true;
            if !DIRS_ONLY
            {
                insert_data_pg(&node, &node_id, parent_id, &[].to_vec());
            }
            return (node, node_id, true);
        },
        Node::Array(arr) => {
            let mut dark = arr.into_iter();

            // This is a directory. Get the node for the directory.
            let mut node = match dark.next() {
                Some(val) => match val {
                    Node::Data(data) => data,
                    _ => panic!{"First node is not a data node!"},
                }
                _ => panic!{"First node is not a data node!"},
            };

            // Recurse through the children. Adding up the size
            // as we go.
            let mut child_dsizes: Vec<u64> = [].to_vec();
            let mut child_ids: Vec<usize> = [].to_vec();

            for c in dark {
                let (child,child_id,is_file) = recurse_data(c, node_id);
                node.asize += child.asize;
                node.dsize += child.dsize;
                if (is_file && !DIRS_ONLY) || (!is_file)
                {
                    child_ids.push(child_id);
                    child_dsizes.push(child.dsize);
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
            insert_data_pg(&node, &node_id, parent_id, &child_ids);

            return (node, node_id, false);
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
    let data: Node = get_data(file);

    recurse_data(data, 0);
}

fn main() {
    let matches = cli::build_cli().get_matches();
    match matches.get_one::<String>("file") {
        Some(file) => build_database(&PathBuf::from(file)),
        _ => panic!{"No file specified"},
    };
}
