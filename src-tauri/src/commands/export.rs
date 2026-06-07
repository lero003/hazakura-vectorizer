use base64::Engine;
use serde::Deserialize;
use tauri_plugin_dialog::DialogExt;

use crate::error::{AppError, AppResult};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    pub contents_base64: String,
    pub suggested_filename: String,
    pub file_kind: String,
    pub title: String,
}

#[tauri::command]
pub async fn save_dialog_and_write(
    app: tauri::AppHandle,
    request: SaveRequest,
) -> AppResult<Option<String>> {
    let mut builder = app
        .dialog()
        .file()
        .set_title(&request.title)
        .set_file_name(&request.suggested_filename);

    if let Some(filter) = default_filter(&request.file_kind) {
        builder = builder.add_filter(filter.0, &[filter.1]);
    }

    let path = match builder.blocking_save_file() {
        Some(p) => p,
        None => return Ok(None),
    };

    let path_buf = match path.into_path() {
        Ok(p) => p,
        Err(e) => return Err(AppError::Dialog(format!("invalid path: {e}"))),
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(request.contents_base64.as_bytes())
        .map_err(|e| AppError::Dialog(format!("base64 decode: {e}")))?;

    std::fs::write(&path_buf, bytes)?;
    Ok(Some(path_buf.to_string_lossy().to_string()))
}

fn default_filter(kind: &str) -> Option<(&'static str, &'static str)> {
    match kind {
        "svg" => Some(("SVG", "svg")),
        "png" => Some(("PNG", "png")),
        _ => None,
    }
}
