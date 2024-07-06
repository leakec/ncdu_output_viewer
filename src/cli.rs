use clap::{Command, ValueHint, Arg};

pub fn build_cli() -> Command {
    Command::new("build_db")
         .arg(Arg::new("file")
             .help("JSON file from NCDU or NCDU-like program.")
                .value_hint(ValueHint::AnyPath),
        )
}
