#!/usr/bin/env bash
# Render cron job: database -> files -> crawl or availability check -> database.
#   scripts/render-job.sh crawl        monthly full crawl (all brands, collections, watches, images)
#   scripts/render-job.sh availability weekly sold-out re-check
set -euo pipefail
export CATALOG_DIR="${CATALOG_DIR:-/tmp/catalog}"
npm run --silent db:migrate
npm run --silent catalog:export
case "${1:-crawl}" in
  crawl) npm run --silent crawl -- --concurrency "${CRAWL_CONCURRENCY:-30}" ;;
  availability) npm run --silent check:availability ;;
  *) echo "unknown job $1" >&2; exit 2 ;;
esac
npm run --silent db:sync -- --catalog-only
