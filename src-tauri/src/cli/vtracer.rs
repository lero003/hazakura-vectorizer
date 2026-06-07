use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{AppError, AppResult};

const VTRACER_BIN: &str = "vtracer";

/// Find the vtracer executable. Tries in this order:
///   1. `VTRACER_BIN` env var override
///   2. Bundled next to the running binary (Tauri externalBin)
///   3. macOS app bundle `Contents/Resources/vtracer` (fallback for older bundle layouts)
///   4. `which vtracer` (PATH lookup — for dev / global install)
pub fn locate_vtracer() -> Result<PathBuf, AppError> {
    if let Ok(p) = std::env::var("VTRACER_BIN") {
        let path = PathBuf::from(p);
        if path.is_file() {
            return Ok(path);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join(VTRACER_BIN);
            if bundled.is_file() {
                return Ok(bundled);
            }

            #[cfg(target_os = "macos")]
            if let Some(contents) = dir.parent() {
                let resources = contents.join("Resources").join(VTRACER_BIN);
                if resources.is_file() {
                    return Ok(resources);
                }
            }
        }
    }

    which_vtracer()
}

fn which_vtracer() -> Result<PathBuf, AppError> {
    let exts: Vec<&str> = if cfg!(windows) {
        vec!["", ".exe"]
    } else {
        vec![""]
    };
    for ext in exts {
        if let Ok(found) = search_path(VTRACER_BIN, ext) {
            return Ok(found);
        }
    }
    Err(AppError::VtracerNotFound)
}

fn search_path(name: &str, ext: &str) -> std::io::Result<PathBuf> {
    let path_var = std::env::var_os("PATH").unwrap_or_default();
    for entry in std::env::split_paths(&path_var) {
        let candidate = entry.join(format!("{name}{ext}"));
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        format!("{name} not found in PATH"),
    ))
}

#[derive(Debug, Clone)]
pub struct VtracerOptions {
    pub colormode: Colormode,
    pub color_precision: u8,
    pub corner_threshold: u8,
    pub filter_speckle: u8,
    pub segment_length: f32,
    pub splice_threshold: u8,
    pub mode: CurveMode,
}

#[derive(Debug, Clone, Copy)]
pub enum Colormode {
    Color,
    Bw,
}

impl Colormode {
    fn as_str(self) -> &'static str {
        match self {
            Colormode::Color => "color",
            Colormode::Bw => "bw",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CurveMode {
    Spline,
}

impl CurveMode {
    fn as_str(self) -> &'static str {
        match self {
            CurveMode::Spline => "spline",
        }
    }
}

impl Default for VtracerOptions {
    fn default() -> Self {
        Self {
            colormode: Colormode::Color,
            color_precision: 6,
            corner_threshold: 60,
            filter_speckle: 4,
            segment_length: 4.0,
            splice_threshold: 45,
            mode: CurveMode::Spline,
        }
    }
}

pub fn vectorize(input_png: &Path, output_svg: &Path, opts: &VtracerOptions) -> AppResult<String> {
    let vtracer_bin = locate_vtracer()?;
    let mut cmd = Command::new(&vtracer_bin);
    cmd.arg("--input").arg(input_png);
    cmd.arg("--output").arg(output_svg);
    cmd.arg("--colormode").arg(opts.colormode.as_str());
    cmd.arg("-m").arg(opts.mode.as_str());
    cmd.arg("-p").arg(opts.color_precision.to_string());
    cmd.arg("-c").arg(opts.corner_threshold.to_string());
    cmd.arg("-f").arg(opts.filter_speckle.to_string());
    cmd.arg("-l").arg(opts.segment_length.to_string());
    cmd.arg("-s").arg(opts.splice_threshold.to_string());

    let output = match cmd.output() {
        Ok(o) => o,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(AppError::VtracerNotFound);
        }
        Err(e) => return Err(AppError::Io(e)),
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("exit code {:?}", output.status.code())
        };
        return Err(AppError::VtracerFailed(detail));
    }

    let svg = std::fs::read_to_string(output_svg)?;
    Ok(svg)
}

pub fn count_paths(svg: &str) -> u32 {
    svg.matches("<path").count() as u32
}

pub fn extract_viewbox(svg: &str) -> Option<(u32, u32)> {
    let open = svg.find("viewBox=\"")?;
    let start = open + "viewBox=\"".len();
    let end = svg[start..].find('"')? + start;
    let value = &svg[start..end];
    let parts: Vec<&str> = value.split_whitespace().collect();
    if parts.len() != 4 {
        return None;
    }
    let w: f32 = parts[2].parse().ok()?;
    let h: f32 = parts[3].parse().ok()?;
    Some((w.round() as u32, h.round() as u32))
}

#[allow(dead_code)]
pub fn ensure_vtracer_available() -> AppResult<PathBuf> {
    let bin = locate_vtracer()?;
    let output = Command::new(&bin)
        .arg("--version")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::VtracerNotFound
            } else {
                AppError::Io(e)
            }
        })?;
    if !output.status.success() {
        return Err(AppError::VtracerFailed(String::from_utf8_lossy(&output.stderr).into_owned()));
    }
    Ok(bin)
}
