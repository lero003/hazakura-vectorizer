use std::path::{Component, Path, PathBuf};

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

/// One file in a bulk-save bundle. The filename must be a bare basename
/// (no directory separators) — the bundle is written into the single
/// folder the user picked, with no nested paths.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFile {
    pub filename: String,
    pub contents_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleRequest {
    pub files: Vec<BundleFile>,
    pub title: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleWriteResult {
    pub target_dir: String,
    pub written: Vec<String>,
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

/// Prompt the user to pick a folder, then write every file in `request.files`
/// into it in one shot. This is the "Save all formats" path used by the
/// export bar's primary action. Returns `None` when the user cancels the
/// folder picker.
#[tauri::command]
pub async fn save_bundle_to_folder(
    app: tauri::AppHandle,
    request: BundleRequest,
) -> AppResult<Option<BundleWriteResult>> {
    if request.files.is_empty() {
        return Err(AppError::InvalidOption("bundle.files is empty".into()));
    }

    let target_dir = pick_folder(&app, &request.title).await?;
    let target_dir = match target_dir {
        Some(d) => d,
        None => return Ok(None),
    };

    if !target_dir.is_dir() {
        return Err(AppError::InputNotFound(target_dir));
    }

    let mut written: Vec<String> = Vec::with_capacity(request.files.len());
    for file in &request.files {
        let safe_name = sanitize_basename(&file.filename)?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(file.contents_base64.as_bytes())
            .map_err(|e| AppError::Dialog(format!("base64 decode: {e}")))?;
        let full = target_dir.join(&safe_name);
        // Belt-and-suspenders: the basename was already sanitized, but
        // re-check the joined path doesn't escape the chosen folder.
        ensure_within(&target_dir, &full)?;
        std::fs::write(&full, &bytes)?;
        written.push(full.to_string_lossy().to_string());
    }

    Ok(Some(BundleWriteResult {
        target_dir: target_dir.to_string_lossy().to_string(),
        written,
    }))
}

async fn pick_folder(app: &tauri::AppHandle, title: &str) -> AppResult<Option<PathBuf>> {
    let app = app.clone();
    let title = title.to_string();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let picker = app.dialog().file().set_title(&title);
        picker.blocking_pick_folder()
    })
    .await
    .map_err(|e| AppError::Dialog(format!("folder picker join: {e}")))?;

    let Some(file_path) = result else {
        return Ok(None);
    };
    let path = file_path
        .into_path()
        .map_err(|e| AppError::Dialog(format!("invalid folder path: {e}")))?;
    Ok(Some(path))
}

/// Strip any directory components, leading dots, and NUL bytes so the
/// filename can only ever be a bare basename inside the target folder.
fn sanitize_basename(raw: &str) -> AppResult<String> {
    if raw.is_empty() {
        return Err(AppError::InvalidOption("filename is empty".into()));
    }
    if raw.contains('\0') {
        return Err(AppError::InvalidOption(
            "filename contains NUL byte".into(),
        ));
    }
    let p = Path::new(raw);
    let mut cleaned = String::new();
    for comp in p.components() {
        match comp {
            Component::Normal(os) => {
                let piece = os.to_string_lossy();
                if piece.is_empty() || piece == "." || piece == ".." {
                    return Err(AppError::InvalidOption(format!(
                        "invalid filename segment: {raw:?}"
                    )));
                }
                if !cleaned.is_empty() {
                    cleaned.push('_');
                }
                cleaned.push_str(&piece);
            }
            Component::CurDir | Component::ParentDir | Component::RootDir
            | Component::Prefix(_) => {
                return Err(AppError::InvalidOption(format!(
                    "invalid filename: {raw:?}"
                )));
            }
        }
    }
    if cleaned.is_empty() {
        return Err(AppError::InvalidOption(format!(
            "filename has no usable segments: {raw:?}"
        )));
    }
    Ok(cleaned)
}

fn ensure_within(root: &Path, candidate: &Path) -> AppResult<()> {
    let root_canon = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let cand_canon = candidate
        .parent()
        .map(|p| p.canonicalize().unwrap_or_else(|_| p.to_path_buf()))
        .unwrap_or_else(|| root_canon.clone());
    if !cand_canon.starts_with(&root_canon) {
        return Err(AppError::InvalidOption(format!(
            "path escapes target folder: {}",
            candidate.display()
        )));
    }
    Ok(())
}

fn default_filter(kind: &str) -> Option<(&'static str, &'static str)> {
    match kind {
        "svg" => Some(("SVG", "svg")),
        "png" => Some(("PNG", "png")),
        _ => None,
    }
}
