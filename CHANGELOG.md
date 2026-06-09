# Changelog

All notable changes to Hazakura Vectorizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-06-09

### Added

- **Multi-mode vectorize (Color + Monochrome in one Convert).** The
  vectorize-mode radio has been replaced with a multi-select checkbox so
  the user can pick `Color`, `Monochrome`, or both. With both checked,
  Convert runs vtracer twice in parallel via the new
  `vectorize_image_multi` Tauri command and keeps each result in a map
  keyed by mode. The SVG preview pane shows a `Color / Monochrome`
  chip switcher; the export bar groups SVG variants by mode with a
  `Color: SVG (元色)` style label.
- **"全形式を書き出す" one-shot save.** A new primary button in the
  export bar opens a folder picker (via the dialog plugin's
  `pick_folder`) and writes every available SVG variant (3 per mode) and
  PNG variant (transparent / white / 512 / 1024) into the chosen folder
  in a single Rust call. The button shows the file count next to its
  label so the user knows what they're committing to. The existing
  per-file save buttons remain for selective export.
- **Cancel + 進捗バー for slow operations.** A small `✕ キャンセル`
  button appears in the convert bar whenever cutout or PNG export is
  running, and a determinate progress bar (with chunk-level percentage)
  replaces the previous `computing…` text. vtracer (which is the
  typical bottleneck of `Convert`) shows an indeterminate shimmer
  since it is still opaque from the JS side. Cancel is implemented via
  a shared `cancelTokensRef: Set<{ cancelled: boolean }>`; every
  cancellable operation allocates a token, the Cancel button flips
  every active token, and each operation checks its own captured
  token at safe boundaries. vtracer remains non-cancellable in v0.2
  (it runs as a separate OS process; plumbing a `kill` is left for a
  later minor).
- `vectorize_image_multi` Tauri command — vectorize the same image with
  multiple `(mode, tuning)` combinations in parallel via
  `spawn_blocking` tasks. Each spec carries a `key` so the result map
  stays ordered and the JS side can pair results with their modes.
- `save_bundle_to_folder` Tauri command — prompts the user for a target
  folder and writes an arbitrary list of `(filename, base64)` files in
  one shot. Filenames are sanitized to a bare basename and the joined
  path is checked against the chosen folder to prevent path traversal.
- `docs/RELEASING.md` — release runbook that documents the v0.1.0 / v0.1.1
  checksum mismatch lessons and step-by-step instructions for cutting a
  new version.
- `scripts/verify-release.sh` — post-upload `shasum -a 256 -c` verifier
  (authenticated `gh release download` + `od -c` filename sanity check).
  Must be run **before** publishing any new release.

### Changed

- **App version is now sourced from `package.json`.** The
  `APP_VERSION` constant in `src/App.tsx` is no longer hardcoded — Vite's
  `define` injects `__APP_VERSION__` at build time so the header /
  About dialog stay in sync with `tauri.conf.json` and `Cargo.toml` on
  every release. Closes the `v0.1.0 · local` UI drift noted in
  `README.md` § 既知の小さな問題.
- Filenames for multi-mode exports now carry the mode prefix
  (`logo-color-original.svg`, `logo-bw-white.svg`, …). Single-mode
  filenames are unchanged so existing automations keep working.
- The static "処理の流れ" pane and bottom status footer were removed.
  Processing state now lives in the convert bar and the preview panes,
  keeping the main workspace focused on Original / Cutout / SVG output.

### Fixed

- Multi-mode individual SVG saves now use the mode attached to the
  clicked export button. Previously those buttons rendered per mode but
  saved whichever mode was active in the SVG preview.

## [0.1.2] - 2026-06-08

Patch release that fixes the v0.1.0 / v0.1.1 checksum mismatch and
synchronizes every version surface to a single source of truth.

### Fixed

- **Checksums are now actually verifiable.** The `SHA256SUMS.txt` shipped in
  the v0.1.0 and v0.1.0 / v0.1.1 Release assets did not match the bytes that
  GitHub served on download, so `shasum -a 256 -c SHA256SUMS.txt` always
  failed. v0.1.2 regenerates the DMG, recomputes the SHA-256, uploads both,
  and verifies the SHA locally *after* download.
- **Version surfaces all move to `0.1.2`.** `package.json`,
  `tauri.conf.json`, and `src-tauri/Cargo.toml` are now in sync, so the
  bundled `.app`'s `Info.plist` (`CFBundleVersion` / `CFBundleShortVersionString`)
  and the DMG filename both read `0.1.2`.
- **`SHA256SUMS.txt` uses basename-only lines.** Filenames are extracted
  with `basename` so the file is path-independent. The GitHub Actions
  release workflow now does the same, so future CI-built releases will
  have the same property.

### Notes

- The v0.1.0 and v0.1.0 / v0.1.1 GitHub Releases remain available for
  historical reference; their release notes now point readers to v0.1.2.
- The v0.1.1 → v0.1.2 jump is a tooling-only bump; no behavior or icon
  changes. The cherry-blossom + V icon has been in the bundle since the
  initial v0.1.0 commit on this branch.

## [0.1.1] - 2026-06-08

**Superseded by v0.1.2 — do not use.** The published `SHA256SUMS.txt`
listed a SHA-256 that did not match the bytes GitHub actually served on
download, and the internal version surfaces were still `0.1.0`. The DMG
filename and `Info.plist` therefore read `0.1.0`, contradicting the
v0.1.1 tag.

The release was meant to be a docs-only patch that made `shasum -c`
work transparently, but the upload was never re-verified end-to-end.

## [0.1.0] - 2026-06-08

First public release. Local PNG / JPG / WebP → SVG vectorizer for logos, icons,
and small assets, with white-background removal and a vtracer-based engine.

### Added

- Drag-and-drop and click-to-pick image input for PNG, JPG, and WebP.
- White-background estimation from edge sampling, with live `Auto / Keep Transparent / Remove White / White Background` modes.
- Cutout preview tuned by `White threshold`, `Edge softness`, and `Remove fringe`.
- vtracer-based vectorization in `Color` and `Monochrome` modes with sliders for `Color precision`, `Filter speckle`, `Corner threshold`, `Segment length`, and `Splice threshold`.
- Four presets: `Logo`, `Icon`, `Simple Color`, and `Monochrome`.
- Cutout-aware SVG output (vectorizes the cutout PNG, not the original) with auto `viewBox` insertion and metadata stripping.
- SVG variants: original, black (`#000000`), and white (`#ffffff`).
- PNG variants: transparent, white-background, 512 px, and 1024 px.
- Light / dark theme that follows the OS setting and is persisted in `localStorage`.
- About dialog with version, license, and repository link.
- Tauri D&D listener for native drag-drop (HTML5 events are consumed by the webview).
- Cutout processing is async + chunked + cancellable to keep the UI responsive.
- Accessibility: `role="radio"`, `role="switch"`, labelled sliders, polite/assertive live regions for toasts.
- Apple Silicon `.app` and `.dmg` bundles with the `vtracer` binary bundled as a Tauri `externalBin` (no end-user install required).

### Notes

- macOS only (aarch64). Intel macOS, Linux, and Windows are not yet packaged.
- The app is `ad-hoc` signed. The first launch will require right-click → Open in `Finder` until Apple Developer ID signing / notarization is added.
