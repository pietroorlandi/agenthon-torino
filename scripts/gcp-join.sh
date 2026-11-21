#!/usr/bin/env bash
# Teammate setup: use the team's existing Google Cloud project (no project creation, no billing).
# Prerequisite: the project owner ran  bash scripts/gcp-add-member.sh <your-gmail>
# Usage: bash scripts/gcp-join.sh <project-id>
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${1:?Usage: bash scripts/gcp-join.sh <project-id>}"

if [[ -z "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ]]; then
  gcloud auth login
fi
gcloud config set project "$PROJECT" >/dev/null

echo "==> Local credentials: in the browser tick ALL permission boxes (Google Cloud included)"
if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  gcloud auth application-default login
fi
gcloud auth application-default set-quota-project "$PROJECT"

[[ -f .env ]] || cp .env.example .env
sed -i "s#^GOOGLE_CLOUD_PROJECT=.*#GOOGLE_CLOUD_PROJECT=$PROJECT#" .env
sed -i "s#^GOOGLE_CLOUD_LOCATION=[^ ]*#GOOGLE_CLOUD_LOCATION=global#" .env
echo "==> .env updated: GOOGLE_CLOUD_PROJECT=$PROJECT, GOOGLE_CLOUD_LOCATION=global"
echo
echo "Done. Verify with: make check"
