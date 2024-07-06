mod cli;

use std::path::PathBuf;

fn build_database(file: &PathBuf) {
    println!{"Path: {}", file.to_str().unwrap()};
}

fn main() {
    let matches = cli::build_cli().get_matches();
    match matches.get_one::<String>("file")
    {
        Some(file) => build_database(&PathBuf::from(file)),
        _ => println!{"No file specified"}
    };
}
