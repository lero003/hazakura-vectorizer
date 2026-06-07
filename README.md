# Hazakura Vectorizer

白背景 PNG / JPG / WebP ロゴを、透過 PNG と再利用しやすい SVG セットに整えるための小さなローカル Tauri アプリです。

写真の高精度イラスト化や Illustrator 級の編集はできません。**個人開発・LP・README 用のロゴ素材を整える小道具** として使います。

## 特徴

- ローカル完結 (画像は外部送信しません)
- ドラッグ & ドロップで PNG / JPG / WebP を読み込み
- 白背景除去のライブプレビュー (4 モード + threshold / softness / fringe)
- vtracer CLI によるカラー / モノクロ SVG 変換
- SVG 派生 (元色 / 黒一色 / 白一色) + PNG 派生 (透過 / 白背景 / 512px / 1024px) を一発書き出し
- 4 種のプリセット (Logo / Icon / Simple Color / Monochrome)
- ライト / ダークテーマ (OS 設定連動)

## 必要なもの

- macOS (Tauri v2 対応環境)
- Node.js 18+ と npm
- Rust (stable)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/) (`npm install -g @tauri-apps/cli@latest`)
- [vtracer](https://github.com/visioncortex/vtracer) (`cargo install vtracer` または `brew install vtracer`)

> vtracer が見つからない場合、変換時にインストール方法を案内するトーストが出ます。

## 開発

```bash
npm install
npm run tauri dev
```

## ビルド

```bash
npm run tauri build
```

成果物: `src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app`

## 使い方

1. アプリを起動し、PNG / JPG / WebP をドロップ
2. サイドバーでプリセット・背景処理・ベクター化オプションを調整
3. 「Convert」を押して SVG と PNG 派生を生成
4. 書き出しバーから欲しい形式を保存 (Save ダイアログで保存先を選択)

## 注意

- ロゴ本体に白が含まれる場合、Remove White でその部分も透明化される可能性があります
- 写真など色数の多い画像は vtracer でパス数が膨大になり、巨大な SVG になります
- このツールは OCR / フォント復元を行いません。画像内の文字はベクターの輪郭としてのみ出力されます
- ai ファイル (Adobe Illustrator) は扱いません。SVG を正規のベクター出力とします

## アーキテクチャ

- Frontend: React 19 + TypeScript + Vite (素の CSS、Hazakura house style デザイントークン)
- Backend: Rust + Tauri v2 + tauri-plugin-dialog
- 変換エンジン: vtracer (subprocess)

```
hazakura-vectorizer/
├── src/                       # React frontend
│   ├── components/            # DropZone, PreviewPane, ...
│   ├── lib/                   # cutout, pngExport, svgVariants, presets, tauriInvoke
│   └── styles/                # tokens, themes, base, app
└── src-tauri/                 # Rust backend
    └── src/
        ├── cli/vtracer.rs     # subprocess ラッパ
        └── commands/          # vectorize_image, save_dialog_and_write
```
