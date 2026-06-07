use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("input file not found: {0}")]
    InputNotFound(PathBuf),

    #[error("unsupported input format: {0}")]
    UnsupportedFormat(String),

    #[error("vtracer binary not found in PATH (install with `brew install vtracer` or `cargo install vtracer`)")]
    VtracerNotFound,

    #[error("vtracer failed: {0}")]
    VtracerFailed(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("dialog error: {0}")]
    Dialog(String),

    #[error("invalid option: {0}")]
    InvalidOption(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = std::result::Result<T, AppError>;
