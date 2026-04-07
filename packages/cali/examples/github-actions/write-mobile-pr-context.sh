#!/usr/bin/env bash

set -euo pipefail

OUTPUT_PATH="${1:-./cali-context.json}"

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
: "${GITHUB_SERVER_URL:?GITHUB_SERVER_URL is required}"
: "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH is required}"
: "${CALI_PLATFORM:?CALI_PLATFORM is required}"
: "${CALI_ARTIFACT_PATH:?CALI_ARTIFACT_PATH is required}"

REPO_OWNER="${GITHUB_REPOSITORY%/*}"
REPO_NAME="${GITHUB_REPOSITORY#*/}"
RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
JOB_URL="${RUN_URL}"

jq -n \
  --arg workspaceRoot "${GITHUB_WORKSPACE}" \
  --arg repoOwner "${REPO_OWNER}" \
  --arg repoName "${REPO_NAME}" \
  --arg branch "${GITHUB_REF_NAME}" \
  --arg sha "${GITHUB_SHA}" \
  --arg platform "${CALI_PLATFORM}" \
  --arg artifactPath "${CALI_ARTIFACT_PATH}" \
  --arg appId "${CALI_APP_ID:-}" \
  --arg deviceName "${CALI_DEVICE_NAME:-}" \
  --arg outputDir "${CALI_OUTPUT_DIR:-./artifacts/qa}" \
  --arg buildId "${GITHUB_RUN_ID:-}" \
  --arg workflowUrl "${RUN_URL}" \
  --arg logsUrl "${JOB_URL}" \
  --slurpfile event "${GITHUB_EVENT_PATH}" \
  '
  ($event[0].pull_request // null) as $pr
  | {
      workspaceRoot: $workspaceRoot,
      repository: {
        provider: "github.com",
        owner: $repoOwner,
        name: $repoName,
        currentBranch: $branch,
        commitSha: $sha
      },
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
        appId: (if $appId == "" then null else $appId end),
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
