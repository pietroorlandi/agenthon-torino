#!/usr/bin/env bash
# Project owner: give a teammate access to Gemini on the team project.
# Usage: bash scripts/gcp-add-member.sh <teammate-gmail> [project-id]
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:?Usage: bash scripts/gcp-add-member.sh <teammate-gmail> [project-id]}"
PROJECT="${2:-$(cat .gcp-project 2>/dev/null || gcloud config get-value project 2>/dev/null)}"
[[ -n "$PROJECT" ]] || { echo "Project id missing"; exit 1; }

# aiplatform.user = call Gemini; serviceUsageConsumer = use the project as ADC quota project
for ROLE in roles/aiplatform.user roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="user:$EMAIL" --role="$ROLE" \
    --condition=None --quiet >/dev/null
  echo "==> $EMAIL: $ROLE on $PROJECT"
done
echo
echo "Send to your teammate:  bash scripts/gcp-join.sh $PROJECT"
