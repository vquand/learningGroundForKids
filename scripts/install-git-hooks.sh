#!/usr/bin/env bash
# One-time per clone: use the versioned hooks in .githooks.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "Git hooks enabled (core.hooksPath=.githooks)."
