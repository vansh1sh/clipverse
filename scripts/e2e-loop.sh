#!/usr/bin/env bash
# Run e2e tests in a loop. Usage: ./scripts/e2e-loop.sh [max_runs]
# Without args, runs 5 times. Set max_runs=0 to run until first failure.

set -e
cd "$(dirname "$0")/.."
MAX_RUNS="${1:-5}"
RUN=0

echo "E2E test loop: max_runs=${MAX_RUNS} (0 = until failure)"
echo "Ensure dev server is running: npm run dev"
echo ""

while true; do
  RUN=$((RUN + 1))
  echo "========== Run #$RUN =========="
  if npx playwright test --project=chromium --retries=0; then
    echo "Run #$RUN passed."
    if [ "$MAX_RUNS" -gt 0 ] && [ "$RUN" -ge "$MAX_RUNS" ]; then
      echo "Completed $MAX_RUNS runs. All passed."
      exit 0
    fi
  else
    echo "Run #$RUN failed."
    exit 1
  fi
done
