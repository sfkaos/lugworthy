#!/usr/bin/env bash
# Render cron job: database -> files -> crawl or availability check -> database.
#   scripts/render-job.sh crawl        monthly full crawl (all brands, collections, watches, images)
#   scripts/render-job.sh availability weekly sold-out re-check
set -euo pipefail
# Catalog files go on disk in the project folder, not /tmp, which may be held in memory.
export CATALOG_DIR="${CATALOG_DIR:-$PWD/.catalog-run}"
# Run each step as one node process: going through npm and the tsx CLI adds about
# 200 MB of extra processes, which matters on a 512 MB instance.
run() { node --import tsx "scripts/$1.ts" "${@:2}"; }
run migrate --skip-read-model
run export-catalog
case "${1:-crawl}" in
  # Each brand is saved as soon as it is crawled, and brands already crawled this month
  # (or since CRAWL_SKIP_SINCE, if later) are skipped, so a rerun after a stopped run
  # picks up where it left off.
  crawl)
    since="$(date -u +%Y-%m-01)"
    if [[ -n "${CRAWL_SKIP_SINCE:-}" && "$CRAWL_SKIP_SINCE" > "$since" ]]; then since="$CRAWL_SKIP_SINCE"; fi
    # If the crawler dies (e.g. out of memory on one heavy site), start it again: it skips
    # brands it already finished, so each attempt continues where the last one stopped.
    crawl_ok=0
    for attempt in 1 2 3 4 5 6 7 8 9 10; do
      if run crawl-catalog --concurrency "${CRAWL_CONCURRENCY:-2}" --save-each --skip-since "$since"; then crawl_ok=1; break; fi
      echo "crawl stopped (attempt $attempt); restarting" >&2
    done ;;
  availability) run check-availability ;;
  *) echo "unknown job $1" >&2; exit 2 ;;
esac
run sync --catalog-only
# Brands saved so far are synced above, but a crawl that never finished still fails the job.
if [[ "${crawl_ok:-1}" != 1 ]]; then echo "crawl did not finish after 10 attempts" >&2; exit 1; fi
