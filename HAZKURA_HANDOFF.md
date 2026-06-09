# Hazakura Vectorizer — Handoff Note

## 状態

v0.1.0 / v0.1.1 / v0.1.2 公開済み。Latest は **v0.1.2** (version surfaces 同期 + チェックサムが `shasum -c` で実検証可能)。
ソースツリーは **v0.2.0 release candidate** に更新中 (Multi-mode vectorize / 全形式一括書き出し / Cancel + 進捗バー)。
リポジトリは public (<https://github.com/lero003/hazakura-vectorizer>)。

`cargo check` / `npx tsc --noEmit` / `npm run build` / `npm run tauri build` すべて通過。
実 GUI での E2E スモークは未実施 (CI / ローカルから実行しただけ)。

**v0.2.0 候補 (未タグ / 未公開)** に以下を追加済み:
- **Multi-mode vectorize** — Color / Monochrome の同時生成。`vectorize_image_multi` Tauri コマンドで並列実行。
- **「全形式を書き出す」** ボタン — フォルダ選択 1 回で SVG 3 種類 (× モード数) + PNG 4 種類を一括保存。`save_bundle_to_folder` Tauri コマンドで実装。
- **Cancel + 進捗バー** — cutout / PNG 生成を中断可能にし、convert bar に確定 / indeterminate progress を表示。
- **APP_VERSION の単一参照化** — Vite `define` で `__APP_VERSION__` を注入。`v0.1.0 · local` ハードコードを撲滅。
- **Multi-mode 個別 SVG 保存修正** — Export bar の各 mode ボタンが、プレビュー中の active mode ではなくクリックされた mode の結果を保存するよう修正。

詳細は `CHANGELOG.md` の `[0.2.0]` セクション、および本ノートの「ワークフロー追加」テーブル。

## 公開リリース (v0.1.2 — Latest)

- リリース: <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.2>
- 配布物: `Hazakura.Vectorizer_0.1.2_aarch64.dmg` (4.3 MB) / `Hazakura.Vectorizer.app.zip` (4.0 MB) / `SHA256SUMS.txt`
- SHA-256 (DMG): `3526ea32c73f40503fe23ad49d3a01ec047de051387401652cfb85d890ef8050`
- SHA-256 (app.zip): `e9b981a57c5960a84d4cc6da4f40cf0bc5e127e62b42f8125f6a31f87b5926b6`
- チェックサム検証: `shasum -a 256 -c SHA256SUMS.txt` (Releases ページからブラウザで 3 ファイル取得後、**両方 OK** を確認済み)
- 署名: **adhoc 署名のみ**。Apple Developer ID での署名・公証は未実装。
  インストール後初回起動は右クリック→「開く」が必要 (詳細はリリースノート参照)。
- vtracer バイナリは `.app` に Tauri `externalBin` として同梱。
- アイコン: 桜 + V モチーフ (sage + sakura ブランドカラー)
- version surfaces すべて `0.1.2` 同期 (package.json / tauri.conf.json / Cargo.toml / Info.plist `CFBundleVersion`)

## 公開リリース (v0.1.1 — Superseded)

- リリース: <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.1>
- 配布物: `Hazakura.Vectorizer_0.1.0_aarch64.dmg` (4.2 MB) / `Hazakura.Vectorizer.app.zip` / `SHA256SUMS.txt`
- 状態: **checksum mismatch 確認済み**。Release ダウンロード後の `shasum -c` は失敗する。内部 version surfaces も `0.1.0` のまま。
- 履歴用に不変で残置。ダウンロードは v0.1.2 推奨。

## 公開リリース (v0.1.0 — 初版 / 参照用)

- リリース: <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.0>
- 配布物: `Hazakura.Vectorizer_0.1.0_aarch64.dmg` / `Hazakura.Vectorizer.app.zip` / `SHA256SUMS.txt`
- 状態: **`SHA256SUMS.txt` が内部ビルドパス (`src-tauri/target/release/bundle/...`) を含むため、検証コマンドはそのまま使えない**。 `awk '{print $1, $2}' SHA256SUMS.txt` のような行抽出で使ってください。
- 履歴用に不変で残置。ダウンロードは v0.1.2 推奨。

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

## リリース運用修正 (v0.1.2 で追加)

| 領域 | 変更点 |
|---|---|
| version surfaces 同期 | `package.json` / `tauri.conf.json` / `Cargo.toml` を `0.1.2` に。 Info.plist の `CFBundleVersion` も `0.1.2` に同期 → DMG ファイル名が `Hazakura Vectorizer_0.1.2_aarch64.dmg` に |
| SHA256SUMS.txt | `basename` でファイル名のみ取り、 ダウンロード後の実ファイル名と一致するよう GitHub ダウンロード後のピリオド版 (例: `Hazakura.Vectorizer_0.1.2_aarch64.dmg`) で記述 |
| 検証プロセス | upload 後に Releases からファイルをダウンロード ( `gh release download` ) して `shasum -a 256 -c SHA256SUMS.txt` を実行、 両方 OK を確認するまで publish としない |
| release.yml | CI 経由の release workflow も `basename` 化し、GitHub のスペース→ピリオド変換に合わせた `SHA256SUMS.txt` を生成。タグ push 後は draft Release に止め、`scripts/verify-release.sh` で remote checksum を確認してから publish |
| v0.1.0 / v0.1.1 リリース | それぞれ本文冒頭に deprecation 案内を追記。 タグと Release ページは不変で残置 |

## v0.2.0 候補 (ワークフロー追加 / バックエンド新コマンド)

| 領域 | 変更点 |
|---|---|
| Multi-mode vectorize | `vectorize_image_multi` コマンド追加。`Vec<{key, options}>` を受け取り、`spawn_blocking` で vtracer を並列起動。JS 側は `Map<VectorizeMode, VectorizeResult>` で保持。 `vectorize_image` (単一) は後方互換のため残置 |
| 一括保存 | `save_bundle_to_folder` コマンド追加。フォルダピッカーを Rust 側 (`dialog().file().blocking_pick_folder`) で起動し、`Vec<{filename, base64}>` をまとめて書き出し。`sanitize_basename` + `ensure_within` で path traversal 対策 |
| キャンセル + 進捗 | `cancelTokensRef: Set<{cancelled: boolean}>` を導入し、cutout effect と handleConvert がそれぞれトークンを取得。`handleCancel` が全トークンを flip して in-flight な全操作を停止。`applyCutoutAsync` / `generatePngVariants` は chunk ごとに `isCancelled` チェックと `onProgress` コールバック。`convert-bar` に 4px のプログレスバー (確定 / indeterminate) と「✕ キャンセル」ボタン。 vtracer は v0.2 では non-cancellable (kill 配管が独立) |
| APP_VERSION 単一参照 | `vite.config.ts` の `define` で `__APP_VERSION__` を `package.json` の `version` から注入。`src/App.tsx` の `APP_VERSION = __APP_VERSION__` で参照。`src/vite-env.d.ts` に ambient 宣言 |
| 書き出しバー | 「全形式を書き出す」 primary ボタン (ファイル数表示付き) + モードごとの SVG グループ (Color / Monochrome タグ付き) |
| ベクター化オプション | radio → checkbox マルチセレクト。 Color / Monochrome / 両方を選べる |
| SVG プレビュー | プレビューヘッダに Color / Monochrome chip switcher (`role="tablist"`) |
| 状態管理 | `vectorizeMode` 単一 → `vectorizeModes: VectorizeModeSet` + `activeMode` 派生。preset トグル、Convert、ファイルロードに応じて結果を prune する effect あり |
| 個別 SVG 保存 | Export bar の mode group から `mode` と `kind` を App へ渡す。Multi-mode でも押したボタンどおりの SVG を保存 |

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
cd hazakura-vectorizer
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
- タグ / Release:
  - `v0.1.0` (初版 / checksum 検証不可) — <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.0>
  - `v0.1.1` (docs-only patch / checksum 検証不可) — <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.1>
  - `v0.1.2` (Latest / checksum 検証可) — <https://github.com/lero003/hazakura-vectorizer/releases/tag/v0.1.2>
- 主要コミット:
  - `8baf3ee Initial commit: Hazakura Vectorizer v0.1`
  - `d5a13a0 Bundle vtracer binary into the .app (Tauri externalBin)`
  - `6abded7 Fix: vectorize cutout PNG, not the original — SVGs become transparent`
  - `d5d7d36 Release v0.1.0: product polish + GitHub release pipeline`
  - `5370633` / `ce80b0a` / `0fa0f7f` / (v0.1.2 コミット): docs と version 0.1.2 同期
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
- **新しいバージョンをリリースするとき**: [`docs/RELEASING.md`](./docs/RELEASING.md) を順番に実行し、 **publish 前に必ず** `./scripts/verify-release.sh <tag>` を回す

## 触る必要がない場所

- `src-tauri/src/error.rs` — `AppError` enum は確定
- `src-tauri/Cargo.toml` の主要 deps — 確定
- capabilities — 最小権限 (`core:default` + dialog のみ)

## 既知の落とし穴 (更新)

- vtracer CLI フラグは plan markdown と異なる (実機検証版を使用): `--colormode color|bw` / `-m spline` / `-p` / `-c` / `-f` / `-l` / `-s`
- 画像 D&D は **Tauri の `onDragDropEvent` を使う** (HTML5 イベントは webview が consume)
- 16MP 以上の画像で cutout が重くなる場合あり。`CHUNK_PIXELS` を下げるか Web Worker 化を検討
- `OffscreenCanvas` を使っているので Safari < 16.4 では動かない。Tauri (WebKit) は基本 OK
- **macOS リリースは adhoc 署名のみ**。Gatekeeper の警告が出るので、初回起動は右クリック→「開く」を案内する。Developer ID での署名・公証は v0.3 以降で検討
- **GitHub Releases の asset 名でスペースがピリオドに置換される** (例: `Hazakura Vectorizer_0.1.2_aarch64.dmg` → `Hazakura.Vectorizer_0.1.2_aarch64.dmg`)。 v0.1.2 の `SHA256SUMS.txt` はダウンロード後のピリオド版で記述しているので、 ブラウザで 3 ファイルをダウンロードして `shasum -c` するとそのまま検証 OK
- **v0.1.0 / v0.1.1 の `SHA256SUMS.txt` は `shasum -c` で検証できない** (v0.1.0 は内部パス入り、v0.1.1 は Release ダウンロード後のファイル名と SHA が不一致)。ダウンロードと検証は v0.1.2 を使用すること
- **Release upload 後の検証を必ずやること**: ローカルで計算した SHA と Releases からダウンロードしたファイルの SHA が一致することを publish 前に確認する。 さもないと今回のような SHA mismatch を生む

## 想定外 / TODO (v0.3 以降)

- Apple Developer ID でのコード署名 + 公証
- スポイト指定の背景色
- 黒背景除去モード
- PDF 出力
- 複数ファイル一括変換
- vtracer キャンセル (v0.2.0 時点では separate OS process のため non-cancellable)
- cutout の Web Worker 化 (現状は main thread + chunked。超巨大画像で重い)
- Intel Mac / Windows / Linux ビルド
- favicon セット / Apple Icon Set 自動生成
- 実 GUI E2E テスト (Playwright + WebDriver, もしくは手動チェックリスト)

## 参考

- 企画書: `hazakura-vectorizer-tauri-plan.md`
- リリース runbook: [`docs/RELEASING.md`](./docs/RELEASING.md) — 新しいバージョンを切る時の手順とハマりポイント
- リリース検証スクリプト: [`scripts/verify-release.sh`](./scripts/verify-release.sh) — publish 前に必ず実行
- デザイントークン参考: `hazakura-note/src/styles/{tokens,themes}.css` (ローカル)
