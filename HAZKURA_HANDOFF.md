# Hazakura Vectorizer — Handoff Note

## 状態

v0.1 Phase 1–6 一括実装 + 安定性修正完了。
`cargo check` / `npx tsc --noEmit` / `npm run build` すべて通過。
Tauri 環境 (`npx tauri info`) も健全。

## 安定性修正サマリ(v0.1.1)

ユーザーから起動後フリーズ報告あり。原因と対処:

| 問題 | 原因 | 対処 |
|---|---|---|
| スクロール/操作でフリーズ | `applyCutout` をメインスレッドで同期実行。16MP 画像で 100〜200ms ブロック | `applyCutoutAsync` に変更。250K ピクセルずつ chunked 処理、`setTimeout(0)` で yield、`CutoutCancelledError` でキャンセル可能に |
| スライダ操作のたびに重い処理が走る | effect の debounce なし | 150ms debounce + `jobIdRef` で古い job をキャンセル |
| 処理中か分からない | ローディング表示なし | `isComputing` state + status bar + Cutout プレビューに "computing…" 表示 |
| HTML5 D&D が無反応 | Tauri webview が drag-drop を consume し `dataTransfer.files` が空 | `getCurrentWebview().onDragDropEvent` で Tauri のイベントを受領、`read_image_file` 経由で bytes 取得し `File` オブジェクトを再構築 |

**未検証**: 実 GUI での E2E。

## 起動方法

```bash
cd /Users/keisetsu/Projects/hazakura-vectorizer
npm install
npm run tauri dev
```

## 前提依存

- Node 18+ / npm (Node 26 / npm 11.12 で検証)
- Rust stable (1.95 で検証)
- Tauri CLI v2 (`npm install -g @tauri-apps/cli@latest`)
- vtracer 0.6.5 (`cargo install vtracer` — brew には formula がない)

## 実装サマリ

| Phase | 内容 | 状況 |
|---|---|---|
| 1 | Tauri + React + TS 骨格 / デザイントークン / CSP / capability | 完了 |
| 2 | 画像 D&D / プレビュー / プリセット UI | 完了 |
| 3 | Canvas 白背景除去 (非同期 + chunked + キャンセル) | 完了 |
| 4 | PNG 派生 (透過 / 白背景 / 512 / 1024) | 完了 |
| 5 | Tauri command + vtracer SVG + SVG 派生 (元/黒/白) | 完了 |
| 6 | Toast / 4096px/25MB 制限 / エラー UI / README / .gitignore | 完了 |
| 7 | 安定性修正 (フリーズ対策 + Tauri D&D) | 完了 |

## 手動 E2E テスト手順(更新版)

1. `npm run tauri dev` でアプリ起動
2. 画像を D&D(ウィンドウ内どこにでも落ちる) **または** クリックして選択
3. プリセット: Logo、背景: Remove White を選択
4. Cutout プレビューが "computing…" → 表示に切り替わる(フリーズしない)
5. サイドバー右下「Convert」を押下 → ステータス: vectorizing → SVG プレビュー + 4 つの PNG 派生ボタン
6. 書き出しバーから「SVG (元色)」「PNG 512px」などを保存
7. 保存ダイアログで保存先を選び、ファイルが正しいか確認

エラー系:
- vtracer を一時的に `PATH` から外す → 「vtracer が見つかりません」 toast
- 4097px の画像を読み込もうとする → サイズ警告 toast
- 何度もスライダを動かしても UI が固まらないことを確認

## 触るべき主要な場所

- **プリセット追加/変更**: `src/lib/presets.ts`
- **白背景除去アルゴリズム**: `src/lib/cutout.ts` (`applyCutoutAsync` / `CHUNK_PIXELS` / `CUTOUT_DEBOUNCE_MS`)
- **vtracer パラメータマッピング**: `src-tauri/src/cli/vtracer.rs` (VtracerOptions 構造体)
- **CSP 変更**: `src-tauri/tauri.conf.json` の `csp` / `devCsp`
- **デザイン変更**: `src/styles/tokens.css` (ライト) / `themes.css` の `[data-theme="dark"]`

## 触る必要がない場所

- `src-tauri/src/error.rs` — `AppError` enum は確定
- `src-tauri/Cargo.toml` の主要 deps — 確定
- capabilities — 最小権限 (`core:default` + dialog のみ)

## 既知の落とし穴(更新)

- vtracer CLI フラグは plan markdown と異なる (実機検証版を使用): `--colormode color|bw` / `-m spline` / `-p` / `-c` / `-f` / `-l` / `-s`
- 画像 D&D は **Tauri の `onDragDropEvent` を使う**(HTML5 イベントは webview が consume)
- 16MP 以上の画像で cutout が重くなる場合あり。`CHUNK_PIXELS` を下げるか Web Worker 化を検討
- `OffscreenCanvas` を使っているので Safari < 16.4 では動かない。Tauri (WebKit) は基本 OK

## 想定外 / TODO

- スポイト指定の背景色
- 黒背景除去モード (v0.2)
- favicon / app icon セット生成
- PDF 出力
- 複数ファイル一括変換
- vtracer バイナリの `externalBin` 同梱 (現在は brew / cargo install 前提)
- cutout の Web Worker 化 (現状は main thread + chunked。超巨大画像で重い)
- 進捗バー(現状は "computing…" テキストのみ)

## 参考

- 企画書: `hazakura-vectorizer-tauri-plan.md`
- 実装計画: `~/.claude/plans/purrfect-waddling-plum.md`
- デザイントークン参考: `/Users/keisetsu/Projects/hazakura-note/src/styles/{tokens,themes}.css`
