#!/usr/bin/env bash
set -euo pipefail
cd "${1:?Bot directory required}"
repo="https://github.com/Investor45/kentechdigitalbot.git"
branch="kentech-custom"
git rev-parse --is-inside-work-tree >/dev/null
previous="$(git rev-parse HEAD)"
git fetch "$repo" "$branch"
latest="$(git rev-parse FETCH_HEAD)"
if [[ "$previous" == "$latest" ]]; then
  echo "KENTECH_ALREADY_CURRENT"
  exit 0
fi
if ! git merge-base --is-ancestor "$previous" "$latest"; then
  echo "This checkout has separate commits. Update from a KENTECH checkout; your files were preserved." >&2
  exit 1
fi
# Preserve edits for recovery, including files newly added upstream.
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  git stash push --include-untracked -m "KENTECH WhatsApp update backup $(date -u +%Y%m%d-%H%M%S)" -- . ':!auto-download-groups.json' ':!auto-download-groups.json.tmp' ':!download-group-guard.json' ':!download-group-guard-status.json' ':!sales-assistant-state.json' ':!registered-contacts.json'
fi
git merge --ff-only "$latest"
yarn install --frozen-lockfile --production=false
for file in index.js lib/client.js lib/baileys.js lib/import-session-bundle.js lib/owner-commands.js lib/deployment-notify.js; do
  node --check "$file"
done
echo "KENTECH_UPDATED"
