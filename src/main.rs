mod cli;

use serde::Deserialize;
use std::path::PathBuf;
use std::str::FromStr;
use postgres::{Client, NoTls};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::process::{Command, Stdio};
use humansize::{format_size, BINARY};
use indicatif::{ProgressBar, ProgressStyle};
//use memory_stats::memory_stats;

use std::fs::{File, create_dir_all, canonicalize};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};

#[derive(Deserialize, Debug)]
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
#[derive(Deserialize, Debug)]
#[serde(untagged)]
enum Node {
    Data(DataNode),
    Array(Vec<Node>),
}

static DIRS_ONLY: AtomicBool = AtomicBool::new(true);
static CREATE_DATABASE: AtomicBool = AtomicBool::new(true);
static ID: AtomicUsize = AtomicUsize::new(0);

struct PgBatch {
    max_queries: i8,
    query_count: i8,
    query: String,
    pg: Option<Client>,
}

impl PgBatch {
    fn flush(&mut self) {
        match &mut self.pg {
            Some(val) => {
                match val.batch_execute(self.query.as_str())
                {
                    Err(e) => panic!{"{}. Query was:\n {}",e,self.query},
                    _ => ()
                }
                self.query = "".to_string();
                self.query_count = 0;
            },
            _ => ()
        }
    }
    fn add_query(&mut self, query: String) {
        self.query += &query;
        self.query_count += 1;
        if self.query_count == self.max_queries {
            self.flush();
        }
    }
}

struct XDiskUsageWriter {
    file: File
}

impl XDiskUsageWriter {
    fn new(file: PathBuf) -> XDiskUsageWriter {
        return XDiskUsageWriter { file: File::create(file).expect("Could not create file.") };
    }
    fn insert_data(&mut self, node: &DataNode, parent_name: String) {
        let _ = self.file.write_all(((node.dsize/1024).to_string() + "\t" + &parent_name + &node.name + "\n").as_bytes());
    }
}

fn insert_data_pg(node: &DataNode, node_id: &usize, parent_id: usize, child_ids: &Vec<usize>, pg_batch: &mut PgBatch)
{
    let dsize_h = format_size(node.dsize, BINARY);
    let asize_h = format_size(node.asize, BINARY);

    let query = format!(
        "INSERT INTO db (id, name, dsize, asize, dsize_h, asize_h, leaf, parent_id, child_ids) VALUES ('{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}');",
        node_id,
        node.name.replace("'","''"),
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
    pg_batch.add_query(query);
}

// Returns the DataNode, the ID of the DataNode, and is_file. If is_file is true,
// then the child is a file. If false, then it was a directory.
fn recurse_data(dir_or_file: Node, parent_id: usize, pbar: Option<&ProgressBar>, pg_batch: &mut PgBatch, parent_string: String, xdu: &mut Option<XDiskUsageWriter>) -> (DataNode, usize, bool) {
    let node_id = ID.fetch_add(1, Ordering::SeqCst);
    match dir_or_file {
        Node::Data(mut node) => {
            // This is a file
            node.leaf = true;
            if !DIRS_ONLY.load(Ordering::Relaxed)
            {
                if CREATE_DATABASE.load(Ordering::Relaxed) {
                    insert_data_pg(&node, &node_id, parent_id, &[].to_vec(), pg_batch);
                }
            }
            match pbar {
                Some(pb) => pb.inc(1),
                _ => ()
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

            let mut child_string = parent_string.clone();
            child_string += &node.name;
            child_string += "/";

            for c in dark {
                let (child,child_id,is_file) = recurse_data(c, node_id, pbar, pg_batch, child_string.clone(), xdu);
                node.asize += child.asize;
                node.dsize += child.dsize;
                if (is_file && !DIRS_ONLY.load(Ordering::Relaxed)) || (!is_file)
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
            if CREATE_DATABASE.load(Ordering::Relaxed) {
                insert_data_pg(&node, &node_id, parent_id, &child_ids, pg_batch);
            }
            
            // Write line in xdu output file
            match xdu {
                Some(writer) => {
                    writer.insert_data(&node, parent_string)},
                _ => ()
            }

            match pbar {
                Some(pb) => pb.inc(1),
                _ => ()
            }
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

fn build_database(file: &PathBuf, xdu_output_file: Option<&String>, use_pbar: bool) {
    //if let Some(usage) = memory_stats() {
    //    println!("Current physical memory usage: {}", usage.physical_mem);
    //    println!("Current virtual memory usage: {}", usage.virtual_mem);
    //} else {
    //    println!("Couldn't get the current memory usage :(");
    //}

    // Create command to get number of lines
    let cmd = Command::new("wc").arg("-l").arg(file).stdout(Stdio::piped()).spawn().unwrap();

    // While counting lines, parse the data structure to get the nodes.
    let data: Node = get_data(file);

    // Get the number of lines from the command
    let (pbar, num_lines) = match use_pbar {
        true => {
            let num_lines: u64 = String::from_utf8(cmd.wait_with_output().expect("failed to wait on wc").stdout).expect("failed to convert bytes to string").rsplit_once(" ").unwrap().0.parse().unwrap();
            let pbar = ProgressBar::new(num_lines);
            pbar.set_style(ProgressStyle::with_template("{bar:40.cyan/grey} {percent}% [{elapsed_precise}<{eta_precise}]").unwrap());
            (Some(pbar), num_lines)
        },
        false => (None, 0)
    };

    //if let Some(usage) = memory_stats() {
    //    println!("Current physical memory usage: {}", usage.physical_mem);
    //    println!("Current virtual memory usage: {}", usage.virtual_mem);
    //} else {
    //    println!("Couldn't get the current memory usage :(");
    //}

    // Create postgress batcher
    let mut pg_batch = PgBatch{
        max_queries: 50,
        query_count: 0,
        query: "".to_string(),
        pg: match CREATE_DATABASE.load(Ordering::Relaxed) {
            true => Some(Client::connect("postgresql://leake:@localhost/database", NoTls).unwrap()),
            false => None
        }
    };

    let mut xdu: Option<XDiskUsageWriter> = match xdu_output_file
    {
        Some(file_name) => Some(XDiskUsageWriter::new(PathBuf::from(file_name))),
        _ => None
    };

    recurse_data(data, 0, pbar.as_ref(), &mut pg_batch, "".to_string(), &mut xdu);
    pg_batch.flush();
    match pbar {
        Some(pbar) => {
            pbar.set_position(num_lines);
            pbar.finish();
        }
        _ => ()
    }

    //if let Some(usage) = memory_stats() {
    //    println!("Current physical memory usage: {}", usage.physical_mem);
    //    println!("Current virtual memory usage: {}", usage.virtual_mem);
    //} else {
    //    println!("Couldn't get the current memory usage :(");
    //}
    //match data {
    //    Node::Data(_) => println!{"Still matching."},
    //    Node::Array(_) => println!{"Still matching."},
    //};
}

fn main() {
    let main_matches = cli::build_cli().get_matches();

    if let Some(matches) = main_matches.subcommand_matches("create-project") {
        let dir = match matches.get_one::<String>("dir") {
            Some(dir) => PathBuf::from(dir),
            _ => panic!{"No directory specified"},
        };

        let mut file = match matches.get_one::<String>("file") {
            Some(file) => PathBuf::from(file),
            _ => panic!{"No file specified"},
        };

        file = canonicalize(&file).unwrap();

        let dark = dir.join(PathBuf::from("data.json"));

        // Create the requested directory if it doesn't exist
        let _ = create_dir_all(dir.clone());

        // Copy template project to new directory
        Command::new("rsync").arg("-a").arg("/usr/local/ncdu-output-viewer/template_project/").arg(dir.to_str().unwrap()).output().expect("Failed to copy files.");

        // Create a symbolic link between the given data file and data.json in the project
        Command::new("ln").arg("-s").arg(file.to_str().unwrap()).arg(dark.to_str().unwrap()).output().expect("Failed to create symbolic link");
        
        // Let the user know they should run make all
        println!{"Project created at {}. Please go to that directory and run make all to view your files.", dir.to_str().unwrap()};
    }

    if let Some(matches) = main_matches.subcommand_matches("build-db") {

        // DIRS_ONLY is the opposite of store_files
        DIRS_ONLY.store(
            match matches.get_one::<bool>("store_files") {
                Some(val) => !val,
                _ => false
            }, Ordering::SeqCst);

        // We want to create the database
        CREATE_DATABASE.store(true, Ordering::SeqCst);

        // use_pbar is the opposite of no_progress
        let use_pbar = match matches.get_one::<bool>("no_pbar") {
            Some(val) => !val,
            _ => true
        };

        let xdu_output_file = None;


        // Get the file that contains the data to put in the database
        match matches.get_one::<String>("file") {
            Some(file) => build_database(&PathBuf::from(file), xdu_output_file, use_pbar),
            _ => panic!{"No file specified"},
        };
    }

    if let Some(matches) = main_matches.subcommand_matches("xdu") {

        let file = match matches.get_one::<String>("file") {
            Some(file) => PathBuf::from(file),
            _ => panic!{"No file specified"},
        };

        // Get the xdu_output_file if it was specified
        let xdu_output_file = match matches.get_one::<String>("output_file") {
            Some(val) => Some(val.to_owned()),
            None => Some(String::from_str("xdu-").unwrap() + file.to_str().unwrap()),
        };

        // use_pbar is the opposite of no_progress
        let use_pbar = match matches.get_one::<bool>("no_pbar") {
            Some(val) => !val,
            _ => true
        };

        // DIRS_ONLY should be true for xdu output
        DIRS_ONLY.store(true, Ordering::SeqCst);

        // We do not want to create the database
        CREATE_DATABASE.store(false, Ordering::SeqCst);

        build_database(&PathBuf::from(file), xdu_output_file.as_ref(), use_pbar)
    }

}
