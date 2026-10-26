#!/usr/bin/env bash
# Render cron job: database -> files -> crawl or availability check -> database.
#   scripts/render-job.sh crawl        monthly full crawl (all brands, collections, watches, images)
#   scripts/render-job.sh availability weekly sold-out re-check
set -euo pipefail
export CATALOG_DIR="${CATALOG_DIR:-/tmp/catalog}"
npm run --silent db:migrate
npm run --silent catalog:export
case "${1:-crawl}" in
  # Each brand is saved as soon as it is crawled, and brands already crawled this month
  # (or since CRAWL_SKIP_SINCE, if later) are skipped, so a rerun after a stopped run
  # picks up where it left off.
  crawl)
    since="$(date -u +%Y-%m-01)"
    if [[ -n "${CRAWL_SKIP_SINCE:-}" && "$CRAWL_SKIP_SINCE" > "$since" ]]; then since="$CRAWL_SKIP_SINCE"; fi
    npm run --silent crawl -- --concurrency "${CRAWL_CONCURRENCY:-4}" --save-each --skip-since "$since" ;;
  availability) npm run --silent check:availability ;;
  *) echo "unknown job $1" >&2; exit 2 ;;
esac
npm run --silent db:sync -- --catalog-only
