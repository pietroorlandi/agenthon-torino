#!/usr/bin/env bash
# One-shot Google Cloud setup for Vertex AI (Gemini).
# Usage: bash scripts/gcp-setup.sh [project-id]
# Idempotent: safe to re-run (e.g. after claiming credits).
set -euo pipefail
cd "$(dirname "$0")/.."

STATE_FILE=".gcp-project"   # remembers the generated project id across runs
if [[ -n "${1:-}" ]]; then
  PROJECT="$1"
elif [[ -f "$STATE_FILE" ]]; then
  PROJECT="$(cat "$STATE_FILE")"
else
  PROJECT="bottega-brain-$(date +%m%d)-$RANDOM"
fi
echo "$PROJECT" > "$STATE_FILE"
echo "==> Project: $PROJECT"

# 1. Login (skipped if already logged in)
if [[ -z "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ]]; then
  gcloud auth login
fi

# 2. Project
if ! gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  echo "==> Creating project"
  gcloud projects create "$PROJECT" --name="Company Brain"
fi
gcloud config set project "$PROJECT" >/dev/null

# 3. Billing (needs the credits claimed at g.dev/credits/devfest-alps-2026)
BILLING="$(gcloud billing accounts list --filter=open=true --format='value(name)' --limit=1 | sed 's#billingAccounts/##')"
if [[ -z "$BILLING" ]]; then
  echo
  echo "!! No billing account found."
  echo "   1) Claim the credits: https://g.dev/credits/devfest-alps-2026 (same Gmail used for gcloud)"
  echo "   2) Re-run: bash scripts/gcp-setup.sh"
  exit 1
fi
echo "==> Linking billing account $BILLING"
gcloud billing projects link "$PROJECT" --billing-account="$BILLING" >/dev/null

# 4. APIs
echo "==> Enabling APIs (takes a minute)"
gcloud services enable aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com cloudtrace.googleapis.com logging.googleapis.com

# 5. Local credentials (ADC)
echo "==> Local credentials: in the browser tick ALL permission boxes (Google Cloud included)"
if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  gcloud auth application-default login
fi
gcloud auth application-default set-quota-project "$PROJECT"

# 6. .env
[[ -f .env ]] || cp .env.example .env
if grep -q '^GOOGLE_CLOUD_PROJECT=' .env; then
  sed -i "s#^GOOGLE_CLOUD_PROJECT=.*#GOOGLE_CLOUD_PROJECT=$PROJECT#" .env
else
  echo "GOOGLE_CLOUD_PROJECT=$PROJECT" >> .env
fi
sed -i "s#^GOOGLE_CLOUD_LOCATION=[^ ]*#GOOGLE_CLOUD_LOCATION=global#" .env  # Gemini 3.x: 404 on europe-west4
echo "==> .env updated: GOOGLE_CLOUD_PROJECT=$PROJECT, GOOGLE_CLOUD_LOCATION=global"

echo
echo "Done. Verify with: make check"
