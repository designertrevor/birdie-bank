#!/bin/sh
# Vercel runs this before every build: exit 0 skips the build, exit 1 builds.
# Build minutes were nearly the whole Vercel bill (October 2026), so skip
# branches nobody previews and pushes that only touch docs or SQL.

case "$VERCEL_GIT_COMMIT_REF" in
  main|overnight*|feedback*) ;;
  *) echo "Skipping build: $VERCEL_GIT_COMMIT_REF is not a preview branch"; exit 0 ;;
esac

# Compare with the last deployed commit on this branch, or the parent commit.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$BASE^{commit}" 2>/dev/null || exit 1

if git diff --quiet "$BASE" HEAD -- . ':(exclude)*.md' ':(exclude)supabase/'; then
  echo "Skipping build: only docs or SQL changed since $BASE"
  exit 0
fi
exit 1
