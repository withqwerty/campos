#!/usr/bin/env bash
# Run all quality checks. Prints errors only by default.
# Usage: scripts/check.sh [--verbose]
set -euo pipefail

verbose=false
[[ "${1:-}" == "--verbose" ]] && verbose=true

failed=0

run() {
  local label="$1"; shift
  if $verbose; then
    printf "\n── %s ──\n" "$label"
    "$@" || { failed=1; printf "✗ %s failed\n" "$label"; }
  else
    local output
    output=$("$@" 2>&1) || { failed=1; printf "✗ %s\n%s\n" "$label" "$output"; }
  fi
}

run "schema"    pnpm generate:schema
# Generate Astro content-collection types so lint/typecheck can resolve
# `astro:content` imports in apps/site/src/content.config.ts. Skipped when
# the site workspace isn't present (e.g. in the exported public repo).
if [ -d "apps/site" ]; then
  run "astro-sync" pnpm --filter @withqwerty/campos-site exec astro sync
fi
run "lint"      pnpm lint
run "format"    pnpm format:check
run "typecheck" pnpm typecheck
run "test"      pnpm test

if [ $failed -eq 0 ]; then
  echo "✓ all checks passed"
else
  echo ""
  echo "✗ some checks failed"
  exit 1
fi
