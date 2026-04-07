#!/usr/bin/env bash

set -euo pipefail

OUTPUT_PATH="${1:-./cali-context.json}"

: "${QA_PLATFORM:?QA_PLATFORM is required}"
: "${APP_PATH:?APP_PATH is required}"
: "${APPLICATION_ID:?APPLICATION_ID is required}"

jq -n \
  --arg workspaceRoot "${PWD}" \
  --arg platform "${QA_PLATFORM}" \
  --arg artifactPath "${APP_PATH}" \
  --arg appId "${APPLICATION_ID}" \
  --arg deviceName "${CALI_DEVICE_NAME:-}" \
  --arg outputDir "${CALI_OUTPUT_DIR:-./artifacts/qa}" \
  --arg buildId "${BUILD_ID:-}" \
  --arg workflowUrl "${WORKFLOW_URL:-}" \
  --arg logsUrl "${WORKFLOW_URL:-}" \
  --arg prJson "${PR_JSON:-}" \
  '
  ($prJson | if . == "" then null else fromjson end) as $pr
  | {
      workspaceRoot: $workspaceRoot,
      pullRequest: (
        if $pr == null then
          null
        else
          {
            number: $pr.number,
            title: $pr.title,
            body: $pr.body,
            url: $pr.html_url,
            labels: (($pr.labels // []) | map(.name)),
            isDraft: ($pr.draft // false),
            baseBranch: $pr.base.ref,
            headBranch: $pr.head.ref
          }
        end
      ),
      mobile: {
        platform: $platform,
        artifactPath: $artifactPath,
        appId: $appId,
        deviceName: (if $deviceName == "" then null else $deviceName end)
      },
      build: {
        id: $buildId,
        workflowUrl: $workflowUrl,
        logsUrl: $logsUrl
      },
      output: {
        outputDir: $outputDir
      }
    }
  | del(.. | nulls)
  ' >"${OUTPUT_PATH}"

echo "Wrote ${OUTPUT_PATH}"
