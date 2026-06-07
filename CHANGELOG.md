# Changelog

All notable changes to Hazakura Vectorizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
