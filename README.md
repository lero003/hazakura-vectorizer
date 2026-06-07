# Hazakura Vectorizer

> ローカル完結の PNG / JPG / WebP → SVG ベクター化ツール。
> 白背景除去のライブプレビューと、vtracer ベースの SVG 変換を、小さな Tauri アプリに収めました。

白背景のロゴ PNG をドロップして、不要な背景を透明化し、SVG と派生 PNG (透過 / 白背景 / 512px / 1024px) に書き出すための小道具です。
Illustrator の代替ではなく、個人開発・LP・README 用の **素材整理** に振り切っています。

![Hazakura Vectorizer icon](src-tauri/icons/icon.png)

## 特徴

- **ローカル完結** — 画像は外部送信しません。
- **ドラッグ & ドロップ** — PNG / JPG / WebP を直接ウィンドウに。
- **白背景除去のライブプレビュー** — `Auto` / `Keep Transparent` / `Remove White` / `White Background` の 4 モード + threshold / softness / fringe 調整。
- **vtracer 同梱** — `Color` / `Monochrome` 両モードで SVG を生成。`-m spline` 系の全パラメータを UI から制御可能。
- **派生アセット一括書き出し** — 透過 PNG / 白背景 PNG / 512px / 1024px と、SVG (元色 / 黒 / 白) をワンクリックで保存。
- **4 種のプリセット** — `Logo` / `Icon` / `Simple Color` / `Monochrome`。
- **ライト / ダークテーマ** — OS 設定連動、`localStorage` に永続化。
- **アクセシビリティ** — `role="radio"` / `role="switch"` / `aria-label` / `aria-live` を整備。

## ダウンロード

macOS (Apple Silicon) 用の DMG を GitHub Releases で配布しています (**developer preview** — adhoc 署名・未公証・GUI E2E 未実施)。

- 配布ページ: [Releases](https://github.com/lero003/hazakura-vectorizer/releases)
- 推奨バージョン: **v0.1.1** (桜アイコン版 / チェックサム検証可能)

DMG を開いたら、`Hazakura Vectorizer.app` を `/Applications` にドラッグしてください。
**初回起動時**は、Apple Silicon Mac のセキュリティ保護により、Gatekeeper が「開発元を確認できない」と警告します。
`/Applications` 上で右クリック (または Control クリック) → 「開く」を選択してください。2 回目以降はダブルクリックで起動できます。

### チェックサムの検証

```bash
# リリースページから DMG / app.zip / SHA256SUMS.txt を同じフォルダにダウンロード
shasum -a 256 -c SHA256SUMS.txt
```

> Apple Developer ID での署名および公証 (notarization) は、まだ組み込まれていません。完全な公証付き配布は次のマイナーで計画中です。
>
> **ファイル名についての注意:** GitHub Releases のアセットはスペースを含むファイル名 (例: `Hazakura Vectorizer_0.1.0_aarch64.dmg`) をダウンロード時にピリオド区切り (例: `Hazakura.Vectorizer_0.1.0_aarch64.dmg`) として保存することがあります。`shasum -c` を使う場合は同梱の `SHA256SUMS.txt` をテキストエディタで開いて、自分のファイル名と一致しているか確認するか、`mv` でリネームしてください。

## 使い方

1. アプリを起動し、PNG / JPG / WebP をドロップ (またはクリックして選択)
2. サイドバーで **プリセット** と **背景処理モード** を選ぶ
3. ライブプレビューを見ながら `White threshold` / `Edge softness` / `Remove fringe` を調整
4. サイドバー下部の **Convert** を押すと、SVG と PNG 派生が生成される
5. 下部の **書き出し** バーから必要な形式 (SVG 元色 / 黒 / 白、PNG 512 / 1024 など) を保存

## アーキテクチャ

```
hazakura-vectorizer/
├── src/                       # React 19 + TypeScript フロントエンド
│   ├── components/            # DropZone, PreviewPane, BackgroundControls, ...
│   ├── lib/                   # cutout, pngExport, svgVariants, presets, tauriInvoke
│   └── styles/                # tokens / themes / base / app (Hazakura house style)
├── src-tauri/                 # Rust + Tauri v2 バックエンド
│   ├── src/
│   │   ├── cli/vtracer.rs     # vtracer サブプロセス ラッパ
│   │   └── commands/          # vectorize_image / read_image_file / save_dialog_and_write
│   ├── binaries/              # vtracer-aarch64-apple-darwin (Tauri externalBin)
│   └── icons/                 # 桜 + V モチーフのアプリアイコン (icns / ico / PNG 全サイズ)
└── .github/workflows/         # macOS ビルド & GitHub Release 公開
```

## 開発

Node 18+ / Rust stable / Tauri CLI v2 が必要です。

```bash
# 依存
npm install
npm install -g @tauri-apps/cli@latest
cargo install vtracer   # 開発時のフォールバック用 (バイナリは src-tauri/binaries/ にも同梱)

# 開発起動
npm run tauri dev

# リリースビルド (.app + .dmg)
npm run tauri build
# 成果物: src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app
#        src-tauri/target/release/bundle/dmg/Hazakura Vectorizer_0.1.0_aarch64.dmg
```

## 動作環境

- macOS (Apple Silicon / aarch64)
- Tauri v2 対応 WebKit (macOS 12 以降)

Intel Mac、Linux、Windows 用のビルドは未確認です。

## 制限

- 写真など色数の多い画像は、vtracer のパス数が膨大になり巨大な SVG になりがちです。ロゴ・アイコン用途に絞ってください。
- `Remove White` はロゴ本体に白が含まれている場合、その部分も透明化される可能性があります。ライブプレビューで必ず確認してください。
- OCR / フォント復元 / 文字のテキスト化は行いません。画像内の文字はベクターの輪郭としてのみ出力されます。
- Adobe Illustrator 形式の `.ai` ファイルは扱いません。SVG を正規のベクター出力とします。

## 謝辞

- Vectorization engine: [vtracer](https://github.com/visioncortex/vtracer) (Apache-2.0)
- Shell: [Tauri](https://tauri.app) (Apache-2.0 / MIT)

## ライセンス

[MIT](./LICENSE) — © 2026 Hazakura
