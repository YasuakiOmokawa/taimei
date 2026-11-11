#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(node -p "const manifest = require('./package.json'); ({ ...manifest.devDependencies, ...manifest.dependencies }).foldkit")"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "error: package.json の foldkit ($version) は範囲を持たない版 (x.y.z) にする" >&2; exit 2; }

readonly SUBTREE_DIR=repos/foldkit
readonly SKILLS=(foldkit generate-program audit-program)
readonly SKILLS_DIR=.claude/skills
readonly LOCK_FILE="$SKILLS_DIR/foldkit-skills.lock.json"

git fetch --quiet --no-tags https://github.com/foldkit/foldkit.git "refs/tags/foldkit@$version"
subtree_tree="$(git rev-parse "FETCH_HEAD^{tree}")"

for skill in "${SKILLS[@]}"; do
  upstream_skill="$(git show "FETCH_HEAD:skills/$skill/SKILL.md")" || { echo "error: foldkit@$version に skills/$skill/SKILL.md が無い" >&2; exit 1; }
  [[ "$upstream_skill" != *$'\nmetadata:'* ]] || { echo "error: foldkit@$version の skills/$skill/SKILL.md は metadata を既に持つ。foldkit-version を足す所を、既にある metadata に足す形へ直す" >&2; exit 1; }
done

git rm -r --force --quiet --ignore-unmatch "$SUBTREE_DIR"
rm -rf "$SUBTREE_DIR"
git read-tree --prefix="$SUBTREE_DIR/" -u FETCH_HEAD

for skill in "${SKILLS[@]}"; do
  rm -rf "${SKILLS_DIR:?}/$skill"
  cp -R "$SUBTREE_DIR/skills/$skill" "$SKILLS_DIR/$skill"
  awk -v version="$version" '
    $0 == "---" { fences++ }
    $0 == "---" && fences == 2 { print "metadata:"; print "  foldkit-version: " version }
    { print }
  ' "$SUBTREE_DIR/skills/$skill/SKILL.md" > "$SKILLS_DIR/$skill/SKILL.md"
  git add --all --force -- "$SKILLS_DIR/$skill"
done

skills_sha256="$(
  for skill in "${SKILLS[@]}"; do find "$SKILLS_DIR/$skill" -type f; done |
    LC_ALL=C sort |
    while IFS= read -r file; do shasum -a 256 "$file"; done |
    shasum -a 256 |
    cut -d ' ' -f 1
)"

printf '{\n  "version": "%s",\n  "sha256": "%s",\n  "tree": "%s"\n}\n' "$version" "$skills_sha256" "$subtree_tree" > "$LOCK_FILE"
git add -- "$LOCK_FILE"

echo "$SUBTREE_DIR と ${SKILLS[*]} を foldkit@$version にした (tree $subtree_tree、skill の sha256 $skills_sha256)"
