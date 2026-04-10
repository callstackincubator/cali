#!/usr/bin/env bash

set -euo pipefail

node ./packages/cali/dist/index.js qa --ci eas --quiet "$@"
