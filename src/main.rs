mod cli;

use std::path::PathBuf;
#[derive(Serialize, Deserialize, Debug)]
struct DataNode {
    name: String,
    mtime: u64,
    #[serde(default = "default_u64_zero")]
    asize: u64,
    #[serde(default = "default_u64_zero")]
    dsize: u64,
    #[serde(default = "default_u64_zero")]
    id: u64,
    #[serde(default = "default_u64_zero")]
    parent_id: u64,
    #[serde(default = "default_vec_zero")]
    child_ids: Vec<u64>,
}

fn default_u64_zero() -> u64 {
    0
}
fn default_vec_zero() -> Vec<u64> {
    [].to_vec()
}

// Define a recursive enum to represent either a DataType or a nested array
#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum Node {
    Data(DataNode),
    Array(Vec<Node>)
}

fn build_database(file: &PathBuf) {
    let parsed: Result<Vec<Value>> = serde_json::from_str(read_to_string(file).unwrap().as_str());

    let data: Vec<Node> = match parsed {
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
}

fn main() {
    let matches = cli::build_cli().get_matches();
    match matches.get_one::<String>("file") {
        Some(file) => build_database(&PathBuf::from(file)),
        _ => panic!{"No file specified"},
    };
}
