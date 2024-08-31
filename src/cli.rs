use clap::{Arg, ArgAction, Command, ValueHint};

pub fn build_cli() -> Command {
    Command::new("main")
        .subcommand(
            Command::new("create-project")
            .arg(Arg::new("dir")
                .help("Name of directory to put the project in.")
                .value_hint(ValueHint::AnyPath)
            )
             .arg(Arg::new("file")
                 .help("JSON file from NCDU or NCDU-like program.")
                    .value_hint(ValueHint::AnyPath),
            )
        )
        .subcommand(
            Command::new("build-db")
             .arg(Arg::new("file")
                 .help("JSON file from NCDU or NCDU-like program.")
                    .value_hint(ValueHint::AnyPath),
            )
             .arg(Arg::new("store_files")
                 .long("store-files")
                 .help("By default, the database will only contain folder sizes doing so significantly speeds up performance. Specifying this option will also store files, which will reduce performance.")
                 .action(ArgAction::SetTrue)
            )
             .arg(Arg::new("no_pbar")
                 .long("no-pbar")
                 .help("By default, a progress bar will be created to show how long is left until the database has been created. Specify this option if you don't want to see a progress bar. This may be useful for things like logging and scripting.")
                 .action(ArgAction::SetTrue)
            )
         )
         .subcommand(
             Command::new("xdu")
             .arg(Arg::new("file")
                 .help("JSON file from NCDU or NCDU-like program.")
                    .value_hint(ValueHint::AnyPath),
            )
             .arg(Arg::new("output_file")
                 .long("output-file")
                 .help("Filename for the xdu_output_file. If none is specified, then the json file name prefixed with xdu- will be used.")
                 .required(false)
            )
             .arg(Arg::new("no_pbar")
                 .long("no-pbar")
                 .help("By default, a progress bar will be created to show how long is left until the database has been created. Specify this option if you don't want to see a progress bar. This may be useful for things like logging and scripting.")
                 .action(ArgAction::SetTrue)
            )
        )
}
