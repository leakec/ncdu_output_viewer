use clap::{Command, ValueHint, Arg, ArgAction};

pub fn build_cli() -> Command {
    Command::new("build_db")
         .arg(Arg::new("file")
             .help("JSON file from NCDU or NCDU-like program.")
                .value_hint(ValueHint::AnyPath),
        )
         .arg(Arg::new("store_files")
             .long("store-files")
             .help("By default, the database will only contain folder sizes doing so significantly speeds up performance. Specifying this option will also store files, which will reduce performance.")
             .action(ArgAction::SetTrue)
        )
         .arg(Arg::new("no_database")
             .long("no-database")
             .help("By default, a database will be created with the data. Specify this option if you don't want to create a database, e.g., you only want to create an xdu output file.")
             .action(ArgAction::SetTrue)
        )
         .arg(Arg::new("xdu_output_file")
             .long("xdu-output-file")
             .help("Filename for the xdu_output_file. If none is specified, then no xdu output will be created. This file is designed for use with xdiskutility.")
             .required(false)
             .default_value("")
        )
}
