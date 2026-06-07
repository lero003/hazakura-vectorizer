# Hazakura Vectorizer 企画・簡易設計メモ

## 1. 概要

**Hazakura Vectorizer** は、PNG/JPG/WebP などのラスター画像を、SVGを中心としたベクター素材に変換するための軽量ローカルツール。

主な想定用途は、写真の高精度ベクター化ではなく、個人開発・Web制作・ロゴ整理・アイコン作成に使える「素材変換の小道具」。

v0.1では **Tauriデスクトップアプリ** として作る。  
理由は、VTracer / Potrace などのCLIを同梱しやすく、画像を外部サーバーに送らずローカル完結できるため。

---

## 2. 背景

ロゴやアイコンを使う場面では、PNGだけだと以下の問題がある。

- 拡大すると荒れる
- ダークテーマ・ライトテーマ用の色違いを作りにくい
- favicon、LP、アプリ、GitHub README などで再利用しにくい
- 透過・白背景・黒背景・黒一色・白一色などの派生素材を毎回作るのが面倒
- AI生成画像やスクリーンショット由来のロゴは、白背景付きPNGになりがち

一昔前は ai ファイルが「正規データ」になりやすかったが、個人開発・Web・アプリ用途では現在は SVG が扱いやすい。

そのため、このツールでは **SVGを正規出力、PNGを派生出力** として扱う。

---

## 3. コンセプト

### 一言で

**白背景PNGロゴを切り抜き、使いやすいSVG/PNG素材セットに整えるローカルアプリ。**

### 目指すもの

- 軽い
- 速い
- ローカル完結
- 画像を外部送信しない
- 操作が少ない
- ロゴ・アイコン用途に強い
- 白背景除去を標準搭載
- CLI同梱で変換品質を確保する
- Illustrator級の本格編集は目指さない

### 目指さないもの

- Photoshop / Illustrator の代替
- 写真の完全なイラスト化
- aiファイルの生成
- 高度な手動パス編集
- 印刷入稿向けの本格DTP機能
- 文字のOCR復元

---

## 4. 想定ユーザー

- 個人開発者
- 小さなWebサイト運営者
- OSSプロジェクト作者
- ブログ・LP・README 用のロゴ素材を整えたい人
- AI生成画像やラフPNGからロゴ素材を作りたい人
- 画像を外部アップロードせずに処理したい人

---

## 5. v0.1 のゴール

v0.1では、以下を達成できればよい。

1. 画像をドラッグ&ドロップできる
2. 白背景を切り抜いて透過化できる
3. 切り抜き後の画像をプレビューできる
4. SVGに変換できる
5. 変換結果をプレビューできる
6. SVGをダウンロードできる
7. PNG派生を書き出せる
8. 白黒・単色・元色の簡単なパターンを作れる
9. 変換処理はローカルで完結する

---

## 6. v0.1 の機能

### 入力

- PNG
- JPG / JPEG
- WebP

### 出力

必須:

- 元色SVG
- 透過PNG
- 白背景PNG
- 512px PNG
- 1024px PNG

優先度高:

- 黒一色SVG
- 白一色SVG
- 黒一色PNG
- 白一色PNG

余力:

- favicon用SVG
- favicon用PNG
- PDF

---

## 7. 中核機能: 白背景切り抜き

このアプリの価値は、単にSVG変換することではなく、**白背景を除去した上で素材化すること**にある。

### 対応したいケース

- 白背景にロゴが載っているPNG
- ほぼ白だが、少しグレーや圧縮ノイズがある背景
- AI生成画像のように、背景が完全な白ではない画像
- アンチエイリアス部分に白が混ざっている画像
- 透明PNGだが、周囲に白フリンジが残っている画像

### 背景処理モード

- **Keep Transparent**
  - 既存の透明部分を維持する
  - 追加の背景除去はしない

- **Remove White**
  - 白または白に近い背景を透明化する
  - ロゴ・アイコン用途の標準

- **White Background**
  - 透明化せず白背景として扱う
  - 印刷用・プレビュー用

- **Auto**
  - 角の色を見て背景色を推定
  - 白背景っぽい場合は Remove White を提案または自動適用

### 調整項目

- White threshold
  - どれくらい白に近い色を背景と見なすか

- Edge softness
  - 輪郭のなじませ具合

- Despill / defringe
  - 白フリンジを減らす

- Invert option
  - 必須ではないが、将来黒背景除去に使える

---

## 8. 白背景除去の処理案

### 基本方針

v0.1では高度なAI背景除去ではなく、**ロゴ・アイコン向けの白背景除去**に絞る。

### 処理フロー

```text
画像読み込み
↓
RGBAに変換
↓
背景色推定
  - 四隅の平均色
  - 画像端のサンプル色
↓
白背景判定
↓
ピクセル単位でアルファ生成
  - 白に近いほど透明
  - 白から遠いほど不透明
↓
エッジ補正
  - 半透明境界を作る
  - 白フリンジを軽減
↓
トリミング
  - 透明余白を削る
↓
前処理済みPNGを生成
↓
VTracer / Potrace に渡す
```

### 簡易アルファ生成の考え方

```ts
const distanceFromWhite = Math.sqrt(
  (255 - r) ** 2 +
  (255 - g) ** 2 +
  (255 - b) ** 2
);

const alpha = clamp(
  (distanceFromWhite - thresholdStart) /
  (thresholdEnd - thresholdStart),
  0,
  1
);
```

実際には、背景色が完全な白とは限らないため、四隅から推定した `backgroundColor` との距離で判定する方がよい。

```ts
const distanceFromBackground = colorDistance(pixel, estimatedBackgroundColor);
```

### 注意

文字やロゴ本体に白が含まれる場合、白背景除去で本体まで消える可能性がある。  
そのため、Remove White はプレビュー必須にする。

---

## 9. ベクター変換エンジン

## 9.1 VTracer

カラー画像のラスター→SVG変換に向いている。

- Rust実装
- CLIあり
- カラーSVGを作りやすい
- Tauriとの相性がよい
- ロゴ・アイコンのカラー変換に向く

## 9.2 Potrace

白黒・単色ロゴ向け。

- 古くからある定番
- 単色ロゴの輪郭抽出に強い
- カラー処理は苦手
- Monochromeモードで使う

## 9.3 v0.1での方針

v0.1では、最初は **VTracer CLI同梱** を第一候補にする。

可能なら次のように分ける。

```text
Color / Logo / Icon:
  VTracer

Monochrome:
  Potrace
```

ただし、初期実装ではVTracerだけでもよい。

---

## 10. Tauri構成

### 技術スタック

- Tauri
- Rust
- React
- TypeScript
- Vite
- Canvas API
- VTracer CLI
- 必要に応じて Potrace CLI

### 役割分担

```text
Frontend React:
  - 画像ドロップ
  - プレビュー
  - 設定UI
  - 変換ボタン
  - ダウンロード操作

Rust / Tauri command:
  - 一時ファイル保存
  - CLI呼び出し
  - SVG読み取り
  - PNG派生保存
  - ファイル保存ダイアログ

Bundled CLI:
  - VTracer
  - Potrace
```

---

## 11. 画面構成

```text
+------------------------------------------------+
| Hazakura Vectorizer                            |
+------------------------------------------------+
|                                                |
|  Drop image here                               |
|  PNG / JPG / WebP                              |
|                                                |
+------------------------------------------------+

[Preset]
( ) Logo
( ) Icon
( ) Simple Color
( ) Monochrome

[Background]
( ) Auto
( ) Keep Transparent
( ) Remove White
( ) White Background

[White Removal]
White threshold: [ 32 ]
Edge softness:   [ 16 ]
Remove fringe:   [ on ]

[Vectorize Options]
Color count:     [ 8 ]
Noise removal:   [ medium ]
Smoothing:       [ medium ]
Simplify:        [ medium ]

[ Convert ]

+----------------------+-------------------------+
| Original Preview     | Cutout Preview          |
|                      |                         |
+----------------------+-------------------------+

+----------------------+-------------------------+
| SVG Preview          | Export Variants         |
|                      | [Original SVG]          |
|                      | [Black SVG]             |
|                      | [White SVG]             |
|                      | [PNG 512]               |
|                      | [PNG 1024]              |
+----------------------+-------------------------+
```

---

## 12. プリセット

```ts
export type VectorizePreset = {
  id: string;
  label: string;
  mode: "color" | "monochrome";
  backgroundMode: "auto" | "keep-transparent" | "remove-white" | "white-background";
  colorCount: number;
  whiteThreshold: number;
  edgeSoftness: number;
  removeFringe: boolean;
  noiseRemoval: "low" | "medium" | "high";
  smoothing: "low" | "medium" | "high";
  simplify: "low" | "medium" | "high";
};

export const presets: VectorizePreset[] = [
  {
    id: "logo",
    label: "Logo",
    mode: "color",
    backgroundMode: "remove-white",
    colorCount: 6,
    whiteThreshold: 32,
    edgeSoftness: 16,
    removeFringe: true,
    noiseRemoval: "high",
    smoothing: "medium",
    simplify: "medium",
  },
  {
    id: "icon",
    label: "Icon",
    mode: "color",
    backgroundMode: "remove-white",
    colorCount: 8,
    whiteThreshold: 28,
    edgeSoftness: 12,
    removeFringe: true,
    noiseRemoval: "medium",
    smoothing: "medium",
    simplify: "high",
  },
  {
    id: "simple-color",
    label: "Simple Color",
    mode: "color",
    backgroundMode: "auto",
    colorCount: 12,
    whiteThreshold: 24,
    edgeSoftness: 12,
    removeFringe: true,
    noiseRemoval: "medium",
    smoothing: "medium",
    simplify: "low",
  },
  {
    id: "monochrome",
    label: "Monochrome",
    mode: "monochrome",
    backgroundMode: "remove-white",
    colorCount: 2,
    whiteThreshold: 36,
    edgeSoftness: 18,
    removeFringe: true,
    noiseRemoval: "high",
    smoothing: "high",
    simplify: "medium",
  },
];
```

---

## 13. 内部処理フロー

```text
画像読み込み
↓
Canvasでプレビュー表示
↓
背景処理
  - Auto / Keep Transparent / Remove White / White Background
↓
切り抜きプレビュー生成
↓
必要なら透明余白をトリミング
↓
前処理済みPNGを一時ファイルに保存
↓
Tauri commandでRust側へ渡す
↓
Rust側でVTracer/Potrace CLIを実行
↓
SVG生成
↓
SVG整形
  - viewBox付与確認
  - 不要メタデータ削除
  - fill色調整
↓
SVGプレビュー
↓
派生書き出し
  - 元色SVG
  - 黒SVG
  - 白SVG
  - 512px PNG
  - 1024px PNG
  - 白背景PNG
  - 透過PNG
```

---

## 14. Tauri command案

```rust
#[tauri::command]
async fn vectorize_image(
    input_path: String,
    options: VectorizeOptions,
) -> Result<VectorizeResult, String> {
    // 1. 入力ファイル検証
    // 2. 一時出力パス作成
    // 3. VTracer / Potrace CLI呼び出し
    // 4. SVG読み取り
    // 5. 結果返却
}
```

```rust
#[derive(serde::Deserialize)]
struct VectorizeOptions {
    mode: String,
    color_count: u32,
    noise_removal: String,
    smoothing: String,
    simplify: String,
}
```

```rust
#[derive(serde::Serialize)]
struct VectorizeResult {
    svg: String,
    width: u32,
    height: u32,
    path_count: Option<u32>,
}
```

---

## 15. ディレクトリ構成案

```text
hazakura-vectorizer/
  README.md
  package.json
  index.html
  src/
    App.tsx
    main.tsx
    components/
      DropZone.tsx
      PreviewPane.tsx
      PresetSelector.tsx
      BackgroundControls.tsx
      ExportButtons.tsx
    lib/
      backgroundRemoval.ts
      imageLoad.ts
      pngExport.ts
      svgVariants.ts
      presets.ts
      tauriVectorize.ts
    styles/
      app.css
  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      commands/
        vectorize.rs
        export.rs
      cli/
        mod.rs
    binaries/
      vtracer/
        macos-arm64/vtracer
        macos-x64/vtracer
      potrace/
        macos-arm64/potrace
        macos-x64/potrace
```

---

## 16. MVP実装タスク

### Phase 1: Tauri + UI

- Tauri + React + TypeScript セットアップ
- 画像ドラッグ&ドロップ
- 元画像プレビュー
- プリセット選択UI
- 背景処理UI
- 書き出しボタンの仮配置

### Phase 2: 白背景切り抜き

- CanvasでRGBA取得
- 四隅から背景色推定
- 白背景判定
- Remove White処理
- Edge softness
- 透過PNG生成
- 切り抜きプレビュー

### Phase 3: PNG派生書き出し

- 512px PNG 書き出し
- 1024px PNG 書き出し
- 白背景PNG 書き出し
- 透過PNG 書き出し
- 透明余白トリミング

### Phase 4: CLI同梱・SVG変換

- VTracer CLI導入
- TauriからCLI実行
- 前処理済みPNGをSVG変換
- SVGプレビュー
- SVGダウンロード

### Phase 5: 派生SVG

- 黒一色SVG
- 白一色SVG
- 元色SVG
- fill色の簡易置換
- SVG最適化

### Phase 6: 整える

- README作成
- サンプル画像追加
- 注意書き追加
- 失敗時エラー表示
- 大きすぎる画像の制限
- CLIが見つからない場合のエラー表示

---

## 17. 注意点

### PNGから作ったSVGは「完全な元データ」ではない

PNGをSVG化しても、元のロゴデータが復元されるわけではない。  
円、文字、線、葉っぱなどの意味が復元されるのではなく、輪郭パスの集合になる。

そのため、編集しやすさは限定的。

### 白いロゴ本体は消える可能性がある

Remove White は便利だが、ロゴ本体に白が含まれる場合、その部分も透明化される可能性がある。  
プレビューと閾値調整は必須。

### 文字の復元は期待しない

画像内の文字をテキストとして復元するのは別問題。  
OCRやフォント推定が必要になるため、v0.1では扱わない。

### 写真は重くなりやすい

写真をSVG化すると、パス数が爆増して巨大なSVGになりがち。  
v0.1では「写真向けではない」と明記する。

### aiファイルは扱わない

aiファイルはAdobe Illustrator前提になりやすく、仕様・互換性・実装コストが重い。  
このツールではSVGを正規のベクター出力として扱う。

---

## 18. README冒頭案

```md
# Hazakura Vectorizer

A small local app for turning PNG/JPG/WebP logo images into reusable SVG and PNG assets.

Hazakura Vectorizer can remove white backgrounds before vectorizing, making it useful for logo cleanup, README assets, favicons, and app icons.

This is not a replacement for Illustrator.
It is a lightweight vectorizing helper for indie developers and small projects.

## Features

- Local-first Tauri app
- Drag and drop image input
- White background removal
- Cutout preview
- SVG export
- Transparent PNG export
- White background PNG export
- Monochrome SVG variants
- Simple presets for logos and icons
```

---

## 19. 成功条件

v0.1の成功条件は以下。

- 白背景PNGロゴを入れると、背景が透明化される
- 切り抜き結果をプレビューできる
- 切り抜き後の画像からSVGが出る
- SVGをブラウザで表示できる
- 512px / 1024px PNGも出せる
- 元画像、切り抜き画像、SVG結果を比較できる
- 使い方が迷わない
- 「本格編集ではない」と分かる
- 画像処理がローカルで完結する

---

## 20. 将来アイデア

- 複数ファイル一括変換
- faviconセット生成
- app iconセット生成
- dark/light用ロゴ生成
- SVG最適化
- パス数表示
- SVGサイズ警告
- 背景除去のスポイト指定
- 黒背景除去
- 透明フリンジ補正強化
- Hazakura Editorとの連携
- PDF出力
- Web版の軽量公開

---

## 21. エージェントへの実装依頼例

```md
このリポジトリに、Hazakura Vectorizer のv0.1を実装してください。

目的は、PNG/JPG/WebP画像を読み込み、白背景を切り抜いた上で、SVGとPNG派生素材を書き出せる軽量Tauriアプリを作ることです。

Tauri + React + TypeScriptで実装してください。

優先順位:
1. Tauri + React + TypeScript の基本構成
2. 画像ドラッグ&ドロップ
3. 元画像プレビュー
4. 背景処理UI
5. Canvasによる白背景除去
6. 切り抜きプレビュー
7. CanvasによるPNG 512px / 1024px 書き出し
8. Tauri commandでVTracer CLIを呼び出す設計
9. SVG変換処理の実装、またはスタブ
10. README作成

重要:
- v0.1ではaiファイル対応は不要です。
- 写真の高精度変換は不要です。
- ロゴ・アイコン素材向けに絞ってください。
- 画像は外部サーバーへ送らず、ローカルで処理してください。
- 白背景除去をSVG変換前に行ってください。
- VTracer/Potrace CLIを後から同梱しやすい構造にしてください。
- 変換エンジンが未実装の場合でも、UIと処理境界を先に作ってください。
```

---

## 22. まとめ

Hazakura Vectorizer は、画像編集アプリではなく、白背景PNGロゴを実用的なSVG/PNGセットに整えるための小さなローカル道具。

基本方針は以下。

```text
アプリ形態: Tauri
処理方針: ローカル完結
前処理: 白背景除去
正規出力: SVG
派生出力: PNG
変換エンジン: VTracer / Potrace CLI
本格編集: 外部ツールに任せる
対象: ロゴ・アイコン・個人開発素材
```
