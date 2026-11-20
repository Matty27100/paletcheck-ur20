#!/usr/bin/env sh
# Build (tests run first) and publish web/dist to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
npm run build
REMOTE=$(git -C .. remote get-url origin)
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="Matei Bejinaru" -c user.email="146110502+Matty27100@users.noreply.github.com" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Published to gh-pages"
