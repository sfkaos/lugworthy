#!/usr/bin/env bash
# Render cron job: database -> files -> crawl or availability check -> database.
#   scripts/render-job.sh crawl        monthly full crawl (all brands, collections, watches, images)
#   scripts/render-job.sh availability weekly sold-out re-check
set -euo pipefail
export CATALOG_DIR="${CATALOG_DIR:-/tmp/catalog}"
# Run each step as one node process: going through npm and the tsx CLI adds about
# 200 MB of extra processes, which matters on a 512 MB instance.
run() { node --import tsx "scripts/$1.ts" "${@:2}"; }
run migrate
run export-catalog
case "${1:-crawl}" in
  # Each brand is saved as soon as it is crawled, and brands already crawled this month
  # (or since CRAWL_SKIP_SINCE, if later) are skipped, so a rerun after a stopped run
  # picks up where it left off.
  crawl)
    since="$(date -u +%Y-%m-01)"
    if [[ -n "${CRAWL_SKIP_SINCE:-}" && "$CRAWL_SKIP_SINCE" > "$since" ]]; then since="$CRAWL_SKIP_SINCE"; fi
    run crawl-catalog --concurrency "${CRAWL_CONCURRENCY:-3}" --save-each --skip-since "$since" ;;
  availability) run check-availability ;;
  *) echo "unknown job $1" >&2; exit 2 ;;
esac
run sync --catalog-only
