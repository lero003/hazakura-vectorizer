# Third-Party Notices

Hazakura Vectorizer は、以下のオープンソースソフトウェアを同梱・利用しています。
それぞれの原作者とライセンスに感謝します。

## vtracer

- Upstream: <https://github.com/visioncortex/vtracer>
- License: Apache License 2.0
- Used as: Tauri `externalBin` として `.app` 内に同梱 (`Hazakura Vectorizer.app/Contents/MacOS/vtracer`)
- 同梱のバイナリは upstream のソースを macOS / aarch64 向けにビルドしたものです

### Apache License 2.0 (要約)

```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### 帰属表示

This product includes software developed by Vision Cortex (https://github.com/visioncortex).

---

## Tauri

- Upstream: <https://tauri.app>
- License: Apache License 2.0 / MIT
- Used as: アプリ全体のランタイム + IPC フレームワーク

## React / Vite / TypeScript

- React: <https://react.dev> — MIT
- Vite: <https://vitejs.dev> — MIT
- TypeScript: <https://www.typescriptlang.org> — Apache-2.0

---

依存ライブラリの完全な一覧とライセンスは、各パッケージの `package.json` / `Cargo.toml` を参照してください。
