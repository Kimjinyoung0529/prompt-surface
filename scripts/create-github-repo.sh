#!/usr/bin/env bash
set -euo pipefail

# Run locally after installing/authenticating the GitHub CLI: gh auth login
# Usage: ./scripts/create-github-repo.sh [repository-name]
REPO="${1:-prompt-surface}"
if ! command -v gh >/dev/null 2>&1; then
  echo 'Please install GitHub CLI (gh) and run `gh auth login` first.' >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo 'Please authenticate: gh auth login' >&2
  exit 1
fi
if [[ ! -d .git ]]; then
  git init -b main
  git add .
  git commit -m 'feat: initial prompt-surface v0.1.0'
fi
# Creates a NEW public repository under the authenticated GitHub account.
# The command fails rather than overwriting an existing repo.
gh repo create "$REPO" --public --source=. --remote=origin --push
