use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::cli::vtracer::{
    self, Colormode, CurveMode, VtracerOptions,
};
use crate::error::{AppError, AppResult};

/// Single mode spec for multi-mode vectorization. `key` is a short
/// caller-chosen identifier (e.g. "color", "bw") used to pair the result
/// with the request on the JS side.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizeSpec {
    pub key: String,
    pub options: VectorizeOptionsJson,
}

/// One result in a multi-mode vectorize call. Keyed by the same `key` the
/// caller provided in the request.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizeMultiEntry {
    pub key: String,
    pub svg: String,
    pub width: u32,
    pub height: u32,
    pub path_count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizeOptionsJson {
    pub mode: String,
    pub color_precision: u8,
    pub corner_threshold: u8,
    pub filter_speckle: u8,
    pub segment_length: f32,
    pub splice_threshold: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorizeResult {
    pub svg: String,
    pub width: u32,
    pub height: u32,
    pub path_count: u32,
}

fn to_vtracer_options(opts: &VectorizeOptionsJson) -> AppResult<VtracerOptions> {
    let colormode = match opts.mode.as_str() {
        "color" => Colormode::Color,
        "bw" => Colormode::Bw,
        other => return Err(AppError::InvalidOption(format!("mode: {other}"))),
    };
    Ok(VtracerOptions {
        colormode,
        color_precision: opts.color_precision.clamp(1, 8),
        corner_threshold: opts.corner_threshold.clamp(0, 180),
        filter_speckle: opts.filter_speckle.clamp(0, 128),
        // vtracer requires segment_length in [3.5, 10]
        segment_length: opts.segment_length.clamp(3.5, 10.0),
        splice_threshold: opts.splice_threshold.clamp(0, 180),
        mode: CurveMode::Spline,
    })
}

#[tauri::command]
pub async fn vectorize_image(
    image_bytes: Vec<u8>,
    options: VectorizeOptionsJson,
) -> AppResult<VectorizeResult> {
    if image_bytes.is_empty() {
        return Err(AppError::InvalidOption("image_bytes is empty".into()));
    }
    let opts = to_vtracer_options(&options)?;

    let svg = tauri::async_runtime::spawn_blocking(move || {
        run_vtracer_job(&image_bytes, &opts)
    })
    .await
    .map_err(|e| AppError::VtracerFailed(format!("worker join: {e}")))??;

    Ok(svg_to_result(&svg))
}

/// Vectorize the same image with multiple (mode, tuning) combinations in
/// parallel. Returns one entry per spec, in submission order.
///
/// Each spec is dispatched to its own `spawn_blocking` task, and each task
/// in turn runs a separate vtracer subprocess (vtracer ships as a CLI, not a
/// library), so the two passes execute concurrently as OS processes. The
/// caller re-pairs the entries with their request via the `key` field.
///
/// This is the path used by the "Color + Monochrome in one Convert"
/// feature in the UI.
#[tauri::command]
pub async fn vectorize_image_multi(
    image_bytes: Vec<u8>,
    specs: Vec<VectorizeSpec>,
) -> AppResult<Vec<VectorizeMultiEntry>> {
    if image_bytes.is_empty() {
        return Err(AppError::InvalidOption("image_bytes is empty".into()));
    }
    if specs.is_empty() {
        return Err(AppError::InvalidOption("specs is empty".into()));
    }

    let mut prepared: Vec<(String, VtracerOptions)> = Vec::with_capacity(specs.len());
    for spec in specs {
        if spec.key.trim().is_empty() {
            return Err(AppError::InvalidOption("spec.key is empty".into()));
        }
        let opts = to_vtracer_options(&spec.options)?;
        prepared.push((spec.key, opts));
    }

    let mut handles = Vec::with_capacity(prepared.len());
    for (key, opts) in prepared {
        let bytes = image_bytes.clone();
        let handle = tauri::async_runtime::spawn_blocking(move || {
            let svg = run_vtracer_job(&bytes, &opts)?;
            Ok::<(String, String), AppError>((key, svg))
        });
        handles.push(handle);
    }

    let mut out: Vec<VectorizeMultiEntry> = Vec::with_capacity(handles.len());
    for handle in handles {
        let (key, svg) = handle
            .await
            .map_err(|e| AppError::VtracerFailed(format!("worker join: {e}")))??;
        let result = svg_to_result(&svg);
        out.push(VectorizeMultiEntry {
            key,
            svg: result.svg,
            width: result.width,
            height: result.height,
            path_count: result.path_count,
        });
    }

    Ok(out)
}

fn run_vtracer_job(image_bytes: &[u8], opts: &VtracerOptions) -> AppResult<String> {
    let tmp_in = tempfile::Builder::new()
        .suffix(".png")
        .tempfile()
        .map_err(AppError::Io)?;
    std::fs::write(tmp_in.path(), image_bytes)?;
    let tmp_out = tempfile::Builder::new()
        .suffix(".svg")
        .tempfile()
        .map_err(AppError::Io)?;
    let svg_path = tmp_out.path().to_path_buf();
    let svg = vtracer::vectorize(tmp_in.path(), &svg_path, opts)?;
    let _ = std::fs::remove_file(&svg_path);
    let _ = std::fs::remove_file(tmp_in.path());
    Ok(svg)
}

fn svg_to_result(svg: &str) -> VectorizeResult {
    let width = vtracer::extract_viewbox(svg).map(|(w, _)| w).unwrap_or(0);
    let height = vtracer::extract_viewbox(svg).map(|(_, h)| h).unwrap_or(0);
    let path_count = vtracer::count_paths(svg);
    VectorizeResult {
        svg: svg.to_string(),
        width,
        height,
        path_count,
    }
}

#[allow(dead_code)]
pub fn write_tempfile(prefix: &str, suffix: &str, bytes: &[u8]) -> AppResult<std::path::PathBuf> {
    let tmp = tempfile::Builder::new()
        .prefix(prefix)
        .suffix(suffix)
        .tempfile()
        .map_err(AppError::Io)?;
    std::fs::write(tmp.path(), bytes)?;
    let path = tmp.path().to_path_buf();
    std::mem::forget(tmp);
    Ok(path)
}

#[allow(dead_code)]
pub fn ensure_path_exists(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::InputNotFound(path.to_path_buf()));
    }
    Ok(())
}

#[tauri::command]
pub async fn read_image_file(path: String) -> AppResult<Vec<u8>> {
    let canonical = Path::new(&path)
        .canonicalize()
        .map_err(|_| AppError::InputNotFound(Path::new(&path).to_path_buf()))?;
    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return Err(AppError::UnsupportedFormat(ext));
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&canonical))
        .await
        .map_err(|e| AppError::Io(std::io::Error::other(format!("worker join: {e}"))))??;
    if bytes.is_empty() {
        return Err(AppError::InvalidOption("file is empty".into()));
    }
    Ok(bytes)
}
