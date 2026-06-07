# Release Runbook

Hazakura Vectorizer の新しいバージョンを GitHub Releases に公開する手順。
**v0.1.0 / v0.1.1 の checksum mismatch 騒動を繰り返さない** ことが最優先のゴール。

## このドキュメントの使い方

- 新しいバージョン (例: v0.1.3, v0.2.0) を切るたびに、 **この runbook の手順を順番に実行する**
- ハマりポイントは末尾の「ハマりポイント」セクションに集約。 詰まったらまずここ
- リリース用 verify スクリプトは `scripts/verify-release.sh`

## ゴール

- すべての version surfaces ( `package.json` / `tauri.conf.json` / `Cargo.toml` / バンドル内 Info.plist ) を新バージョンに同期
- `shasum -a 256 -c SHA256SUMS.txt` が **Releases からブラウザでダウンロードしたファイルでそのまま検証 OK**
- 旧リリースを不変で残しつつ、本文に deprecation 案内を追記

## 事前チェック

- [ ] main ブランチがリリース可能な状態 (CI グリーン、 レビュー反映済み)
- [ ] 実 GUI での動作確認 (実施した場合)
- [ ] 公開リポジトリ (or 公開予定)
- [ ] 未コミットの変更がない ( `git status --short` が空)
- [ ] `gh auth status` で GitHub CLI 認証済み

## 手順

### 1. Version surfaces を上げる

新バージョン (例: `0.1.3`) をすべての version 表記に反映する:

| ファイル | フィールド |
| --- | --- |
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `[package].version` |
| `src/App.tsx` | `APP_VERSION` 定数 (あれば) |

一括置換スクリプト:

```bash
NEW_VERSION="0.1.3"
sed -i '' "s/\"version\": \"0.1.2\"/\"version\": \"$NEW_VERSION\"/" package.json
sed -i '' "s/\"version\": \"0.1.2\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
sed -i '' "s/version = \"0.1.2\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
# src/App.tsx の APP_VERSION も同じ考え方で更新
```

置換後、 `rg '0\.1\.2' -g '!CHANGELOG.md' -g '!HAZKURA_HANDOFF.md'` で取りこぼしがないか確認。

### 2. CHANGELOG.md にエントリ追加

`## [Unreleased]` の下に新バージョンのセクションを追加:

```markdown
## [<NEW_VERSION>] - <YYYY-MM-DD>

### Added
- ...

### Fixed
- ...
```

### 3. コミット & push

```bash
git add -A
git commit -m "Release v<NEW_VERSION>: <summary>"
git push origin main
```

### 4. ローカルでビルド

```bash
npm install
npm run tauri build
```

成果物:

- `src-tauri/target/release/bundle/dmg/Hazakura Vectorizer_<NEW_VERSION>_aarch64.dmg`
- `src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app`

**Info.plist の `CFBundleVersion` が新バージョンになっていること**:

```bash
APP="src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app"
plutil -p "$APP/Contents/Info.plist" | grep -E "CFBundleVersion|CFBundleShortVersionString"
```

期待値: 両方とも `<NEW_VERSION>` (例: `0.1.3`)。

### 5. app.zip を作成

```bash
APP="src-tauri/target/release/bundle/macos/Hazakura Vectorizer.app"
DMG_SRC="src-tauri/target/release/bundle/dmg/Hazakura Vectorizer_${NEW_VERSION}_aarch64.dmg"
WORK=$(mktemp -d)
cp "$DMG_SRC" "$WORK/Hazakura Vectorizer_${NEW_VERSION}_aarch64.dmg"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$WORK/Hazakura Vectorizer.app.zip"
cd "$WORK"
```

### 6. SHA256SUMS.txt を生成

**`basename` + GitHub ダウンロード後のファイル名 (ピリオド区切り) で記述する**:

```bash
DMG_SHA=$(shasum -a 256 "Hazakura Vectorizer_${NEW_VERSION}_aarch64.dmg" | awk '{print $1}')
ZIP_SHA=$(shasum -a 256 "Hazakura Vectorizer.app.zip" | awk '{print $1}')
printf '%s  %s\n%s  %s\n' \
  "$DMG_SHA" "Hazakura.Vectorizer_${NEW_VERSION}_aarch64.dmg" \
  "$ZIP_SHA" "Hazakura.Vectorizer.app.zip" \
  > SHA256SUMS.txt
```

`od -c SHA256SUMS.txt | head -5` で実バイトを必ず確認 (半角スペースとピリオドは視覚で見分けがつかない)。

### 7. ドラフトで Release 作成

リリースノートを `/tmp/release-notes-v${NEW_VERSION}.md` に書き:

```bash
gh release create "v${NEW_VERSION}" \
  --repo lero003/hazakura-vectorizer \
  --title "Hazakura Vectorizer v${NEW_VERSION}" \
  --notes-file "/tmp/release-notes-v${NEW_VERSION}.md" \
  --target main \
  --draft \
  "Hazakura Vectorizer_${NEW_VERSION}_aarch64.dmg" \
  "Hazakura Vectorizer.app.zip" \
  "SHA256SUMS.txt"
```

### 8. アップロード後の検証 (**publish 前に必ず実行**)

```bash
./scripts/verify-release.sh "v${NEW_VERSION}"
```

スクリプトが Releases から 3 ファイルを取得し、 `shasum -a 256 -c SHA256SUMS.txt` を実行する。
**両方のアセットが `OK` になるまで publish に進まない**。 失敗したら SHA256SUMS.txt か DMG / app.zip を再生成して ステップ 5 からやり直す。

### 9. publish

```bash
gh release edit "v${NEW_VERSION}" \
  --repo lero003/hazakura-vectorizer \
  --draft=false
```

### 10. 後処理

- [ ] 旧リリースの本文冒頭に deprecation 案内を追記:

  ```bash
  for old in v0.1.0 v0.1.1; do
    gh release view "$old" --repo lero003/hazakura-vectorizer --json body --jq '.body' > /tmp/old-body.md
    cat /tmp/deprecation-prefix.md /tmp/old-body.md > /tmp/old-body-new.md
    gh release edit "$old" --repo lero003/hazakura-vectorizer --notes-file /tmp/old-body-new.md
  done
  ```

  deprecation-prefix.md のテンプレ:

  ```markdown
  > ⚠️ **This release is superseded by v<NEW_VERSION>.** ...  
  > **Please use [v<NEW_VERSION>](https://github.com/lero003/hazakura-vectorizer/releases/tag/v<NEW_VERSION>).**
  > This release is preserved for historical reference only.
  >
  > ---

  ```

- [ ] HAZKURA_HANDOFF.md の「リモート → タグ / Release」セクションに新リリースを追加、 旧リリースを履歴セクションに移動
- [ ] README.md の「推奨バージョン」を更新
- [ ] コミット & push ( `d2599f5` のような Release コミット)

### 11. 動作確認 (任意)

- ブラウザで <https://github.com/lero003/hazakura-vectorizer/releases/tag/v<NEW_VERSION>> を開く
- 3 ファイルを別フォルダにダウンロード
- `cd <folder> && shasum -a 256 -c SHA256SUMS.txt` → 両方 OK を確認
- DMG をマウントして `Hazakura Vectorizer.app` の Info.plist で `CFBundleVersion` を確認

## ハマりポイント (過去事例から)

### curl の User-Agent
`curl` のデフォルト UA (`curl/8.7.1`) だと GitHub CDN が "Not Found" を返すことがある。
検証スクリプトは `gh release download` (認証付き) を使うため影響なし。 ローカルで手動検証する場合は `curl -A "Mozilla/5.0"` を渡すか、 `gh release download` を使う。

### ファイル名変換 (スペース → ピリオド)
GitHub Releases はアップロード時のファイル名を保存時に変換する。 `Hazakura Vectorizer.app.zip` のスペースは `Hazakura.Vectorizer.app.zip` のようにピリオドに置換される。
**SHA256SUMS.txt は変換後のファイル名 (ピリオド区切り) で記述する**。

視覚ではスペースとピリオドの判別がつかないので、 `od -c` で必ず実バイトを確認する:

```bash
od -c SHA256SUMS.txt | head -5
```

`Hazakura` の後に `0x20` (スペース) ではなく `0x2e` (ピリオド) が来ていること。

### draft は URL からの直接ダウンロード不可
GitHub Releases の draft は認証なしではダウンロードできない。 検証には認証付きの `gh release download` を使うか、 先に publish する必要がある (ただし publish 後に検証失敗したら取り返しがつかないので、 `gh release download` を使う方が安全)。

### version surfaces の取りこぼし
`package.json` / `tauri.conf.json` / `Cargo.toml` のいずれかを更新し忘れると、 DMG ファイル名とバンドル内 Info.plist のバージョンが古いままになる。 **ステップ 1 の一括置換 + `rg` での取りこぼし確認** を必ずやる。

### v0.1.0 / v0.1.1 の教訓
v0.1.0 / v0.1.1 では次のいずれもやっていなかった:

1. アップロード後の `shasum -c` 検証
2. `SHA256SUMS.txt` 内のファイル名と GitHub ダウンロード後のファイル名の一致確認
3. Version surfaces の同期

この runbook の **ステップ 8 が最重要**。 publish 前に必ず `./scripts/verify-release.sh` を回す。

## 参考

- `scripts/verify-release.sh` — アップロード後の checksum 検証スクリプト
- `.github/workflows/release.yml` — CI 経由の release workflow ( `basename` + ピリオド変換済み)
- `HAZKURA_HANDOFF.md` — リポジトリの状態とリリース履歴
