#!/usr/bin/env bash

set -euo pipefail

OUTPUT_PATH="${1:-./cali-context.json}"
node ./packages/cali/dist/index.js write-mobile-pr-context \
  --from github-actions \
  --output "${OUTPUT_PATH}"
