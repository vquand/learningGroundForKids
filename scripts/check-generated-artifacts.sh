#!/usr/bin/env bash
# Reads newline-separated repository paths on stdin and fails when any of them
# is generated evidence or a working artifact that AGENTS.md keeps out of Git:
# screenshots, recordings, traces, raw benchmark results, logs, coverage output
# and generated verification/UAT reports (including the local output/ folder).
set -euo pipefail

forbidden='^output/|^artifacts/|(^|/)test-results/|(^|/)playwright-report/|(^|/)coverage/|(^|/)\.test-tmp/|^docs/(evidence|performance|test-evidence)/|(^|/)(screenshots?|recordings?)/|\.(trace\.zip|webm|har|log)$'

offenders="$(grep -E "$forbidden" || true)"
if [[ -n "$offenders" ]]; then
  count="$(printf '%s\n' "$offenders" | wc -l | tr -d ' ')"
  {
    echo "Blocked: $count generated evidence/artifact file(s) must stay local (see AGENTS.md, Baseline checks):"
    printf '%s\n' "$offenders" | head -20 | sed 's/^/  /'
    [[ "$count" -gt 20 ]] && echo "  ... and $((count - 20)) more"
    echo "Untrack them with: git rm -r --cached <path>   (local copies are kept)"
  } >&2
  exit 1
fi
