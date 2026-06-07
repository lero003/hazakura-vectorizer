#!/usr/bin/env bash
# scripts/verify-release.sh
#
# 使い方:
#   ./scripts/verify-release.sh <tag>          # デフォルト: lero003/hazakura-vectorizer
#   REPO=other/repo ./scripts/verify-release.sh <tag>
#
# 機能:
#   GitHub Releases から <tag> のアセット (DMG / app.zip / SHA256SUMS.txt) を
#   認証付きでダウンロードし、 `shasum -a 256 -c SHA256SUMS.txt` で
#   チェックサムを検証する。 **publish 前に必ず実行すること。**
#
# 終了コード:
#   0  検証 OK (両方のアセットが SHA256SUMS.txt と一致)
#   1  検証 NG (SHA mismatch)
#   2  入力エラー (タグ未指定など)
#   3  アセット取得失敗 (リリース未公開、 タグ typo など)
#
# 設計メモ:
#   - `curl` のデフォルト UA だと GitHub CDN が "Not Found" を返すことがあるため、
#     認証付きの `gh release download` を使う。
#   - ファイル名は GitHub Releases が保存したものを使う。 スペースがピリオドに
#     変換されている場合は SHA256SUMS.txt 側もその前提で書かれている必要がある
#     (詳細は docs/RELEASING.md を参照)。

set -euo pipefail

# ---- 引数チェック ----
if [ $# -lt 1 ]; then
  echo "usage: $0 <tag>  (e.g. v0.1.2)" >&2
  exit 2
fi

TAG="$1"
REPO="${REPO:-lero003/hazakura-vectorizer}"

# ---- 依存コマンド ----
for cmd in gh shasum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command '$cmd' not found in PATH" >&2
    exit 2
  fi
done

# ---- 認証チェック ----
if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated. Run 'gh auth login' first." >&2
  exit 2
fi

# ---- 作業ディレクトリ ----
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "==> Verifying release $REPO@$TAG"
echo "    Work dir: $WORK"
echo

# ---- アセット一覧の事前確認 ----
echo "==> Listing assets on the release"
ASSET_NAMES=$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')
echo "$ASSET_NAMES" | sed 's/^/    - /'
echo

# ---- ダウンロード ----
echo "==> Downloading assets via 'gh release download' (authenticated)"
if ! gh release download "$TAG" --repo "$REPO" --dir "$WORK" --clobber; then
  echo "error: failed to download release assets" >&2
  echo "       (is the tag published? draft releases need auth, but the" >&2
  echo "        auth header above should handle that.)" >&2
  exit 3
fi

cd "$WORK"

# ファイルが揃っているか確認
for required in SHA256SUMS.txt; do
  if [ ! -f "$required" ]; then
    echo "error: $required missing from the release" >&2
    exit 3
  fi
done

echo
echo "==> Downloaded files"
ls -lh "$WORK" | sed 's/^/    /'
echo

# SHA256SUMS.txt の内容を可視化 (スペースとピリオドの判別用)
echo "==> SHA256SUMS.txt (raw bytes; verify the filename encoding)"
od -c SHA256SUMS.txt | head -5 | sed 's/^/    /'
echo

# ---- チェックサム検証 ----
echo "==> Running 'shasum -a 256 -c SHA256SUMS.txt'"
if shasum -a 256 -c SHA256SUMS.txt; then
  echo
  echo "==> All checksums verified for $TAG. Safe to publish."
  exit 0
else
  echo
  echo "==> CHECKSUM MISMATCH detected." >&2
  echo "    Do NOT publish this release. Regenerate SHA256SUMS.txt and" >&2
  echo "    the affected assets, then re-run this script." >&2
  echo "    See docs/RELEASING.md for the full procedure." >&2
  exit 1
fi
