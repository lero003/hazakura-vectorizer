# Hazakura Vectorizer — Handoff Note

## 状態

v0.1.0 公開済み。GitHub Release `v0.1.0` に DMG / `.app.zip` / `SHA256SUMS.txt` をアップロード済み。
リポジトリは public (<https://github.com/lero003/hazakura-vectorizer>)。

`cargo check` / `npx tsc --noEmit` / `npm run build` / `npm run tauri build` すべて通過。
実 GUI での E2E スモークは未実施 (CI / ローカルから実行しただけ)。

## 公開リリース (v0.1.0)

- リリース: <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.0>
- 配布物: `Hazakura Vectorizer_0.1.0_aarch64.dmg` (4.3 MB) / `Hazakura.Vectorizer.app.zip` (4.0 MB) / `SHA256SUMS.txt`
- SHA-256 (DMG): `3f9655a633dcadcfd894cce5d2f2958819d6405a5816b170edab9a937ede90cd`
- SHA-256 (app.zip): `71c03ec560d24698c609c36e5236f5025c87efe266ae36d17bfbe1918df49e86`
- 署名: **adhoc 署名のみ**。Apple Developer ID での署名・公証は未実装。
  インストール後初回起動は右クリック→「開く」が必要 (詳細はリリースノート参照)。
- vtracer バイナリは `.app` に Tauri `externalBin` として同梱。

## 製品レベル仕上げ (v0.1.0 で追加)

| 領域 | 変更点 |
|---|---|
| アイコン | 桜 + V モチーフの新規 SVG を作成、`tauri icon` で icns/ico/PNG 全サイズを再生成。`Square*.png` / `StoreLogo.png` / iOS / Android 用は `.gitignore` で追跡除外 |
| メタデータ | `tauri.conf.json` の `bundle.category=cDeveloperTool`, copyright, publisher, homepage, shortDescription, longDescription を整備。`Cargo.toml` に authors / license=MIT / repository / rust-version を追加 |
| アクセシビリティ | radio / switch / slider に `role` / `aria-checked` / `aria-label` / `aria-valuetext` を付与。Toast を `role=status/alert` + `aria-live` に |
| UX | Convert ボタンをサイドバー底面の `convert-bar` に移動 (sticky)。SVG ペインに処理フロー 4 ステップを表示。トースト重複抑止 |
| About ダイアログ | ヘッダー右上の「About」ボタンから ESC キーで閉じられるモーダル |
| index.html | `<meta name="description">` 追加 |
| CI | `.github/workflows/ci.yml` (PR/push で tsc + vite build + cargo check) と `release.yml` (タグ push で macOS ビルド → DMG + `.app.zip` + SHA-256 を Release に publish) を追加 |
| ドキュメント | `LICENSE` (MIT), `CHANGELOG.md` (Keep a Changelog 準拠), `README.md` 全面書き直し (ダウンロード / インストール / 使い方 / アーキテクチャ / 開発 / 制限 / ライセンス) |

## 安定性修正サマリ (v0.1.1 で導入済み)

| 問題 | 原因 | 対処 |
|---|---|---|
| スクロール/操作でフリーズ | `applyCutout` をメインスレッドで同期実行。16MP 画像で 100〜200ms ブロック | `applyCutoutAsync` に変更。250K ピクセルずつ chunked 処理、`setTimeout(0)` で yield、`CutoutCancelledError` でキャンセル可能に |
| スライダ操作のたびに重い処理が走る | effect の debounce なし | 150ms debounce + `jobIdRef` で古い job をキャンセル |
| 処理中か分からない | ローディング表示なし | `isComputing` state + status bar + Cutout プレビューに "computing…" 表示 |
| HTML5 D&D が無反応 | Tauri webview が drag-drop を consume し `dataTransfer.files` が空 | `getCurrentWebview().onDragDropEvent` で Tauri のイベントを受領、`read_image_file` 経由で bytes 取得し `File` オブジェクトを再構築 |

**未検証**: 実 GUI での E2E (リリースビルド済み DMG を Finder で開いて起動確認するのは手元で可能だが、未実施)。

## 起動方法

```bash
cd /Users/keisetsu/Projects/hazakura-vectorizer
npm install
npm run tauri dev
```

## 配布物

- GitHub Release: <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.0>
- ローカルビルド:
  - `.app`: `src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app` (~12MB, vtracer 同梱)
  - `.dmg`: `src-tauri/target/release/bundle/dmg/Hazakura Vectorizer_0.1.0_aarch64.dmg` (4.3MB)
  - バイナリ単体: `src-tauri/target/release/hazakura-vectorizer`
  - **vtracer 同梱**: `src-tauri/binaries/vtracer-aarch64-apple-darwin` (2.1MB, commit 済み)

## リモート

- GitHub: <https://github.com/lero003/hazakura-vectorizer> (public, since v0.1.0 release)
- 主要コミット:
  - `8baf3ee Initial commit: Hazakura Vectorizer v0.1`
  - `d5a13a0 Bundle vtracer binary into the .app (Tauri externalBin)`
  - `6abded7 Fix: vectorize cutout PNG, not the original — SVGs become transparent`
  - `d5d7d36 Release v0.1.0: product polish + GitHub release pipeline`
- アップロードされたファイル: ソース / 設定 / ドキュメント / アイコン / vtracer バイナリ / CI ワークフロー。`node_modules` / `dist` / `src-tauri/target` / `*.app` / `*.dmg` / iOS・Android 用アイコンは `.gitignore` で除外済み。機密情報なし。

## 前提依存

**ビルド時のみ必要**(エンドユーザは .app をダブルクリックで動く):
- Node 18+ / npm
- Rust stable
- Tauri CLI v2 (`npm install -g @tauri-apps/cli@latest`)

**vtracer は .app に同梱済み** — 別途インストール不要。

> Intel Mac はサポート外 (Tauri v2 + vtracer バイナリは aarch64 のみ)。

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

## 既知の落とし穴 (更新)

- vtracer CLI フラグは plan markdown と異なる (実機検証版を使用): `--colormode color|bw` / `-m spline` / `-p` / `-c` / `-f` / `-l` / `-s`
- 画像 D&D は **Tauri の `onDragDropEvent` を使う** (HTML5 イベントは webview が consume)
- 16MP 以上の画像で cutout が重くなる場合あり。`CHUNK_PIXELS` を下げるか Web Worker 化を検討
- `OffscreenCanvas` を使っているので Safari < 16.4 では動かない。Tauri (WebKit) は基本 OK
- **macOS リリースは adhoc 署名のみ**。Gatekeeper の警告が出るので、初回起動は右クリック→「開く」を案内する。Developer ID での署名・公証は v0.2 で計画
- **GitHub Releases の asset 名でスペースがピリオドに置換される** (例: `Hazakura Vectorizer.app.zip` → `Hazakura.Vectorizer.app.zip`)。これは GitHub 側の挙動

## 想定外 / TODO (v0.2 以降)

- Apple Developer ID でのコード署名 + 公証
- スポイト指定の背景色
- 黒背景除去モード
- PDF 出力
- 複数ファイル一括変換
- 進捗バー (現状は "computing…" テキストのみ)
- cutout の Web Worker 化 (現状は main thread + chunked。超巨大画像で重い)
- Intel Mac / Windows / Linux ビルド
- favicon セット / Apple Icon Set 自動生成
- 実 GUI E2E テスト (Playwright + WebDriver, もしくは手動チェックリスト)

## 参考

- 企画書: `hazakura-vectorizer-tauri-plan.md`
- 実装計画: `~/.claude/plans/purrfect-waddling-plum.md`
- デザイントークン参考: `hazakura-note/src/styles/{tokens,themes}.css` (ローカル)
