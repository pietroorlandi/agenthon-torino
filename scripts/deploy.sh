#!/usr/bin/env bash
# Deploy to Cloud Run from source (Cloud Build builds the Dockerfile). Reads non-secret settings from .env.
# Usage: ./scripts/deploy.sh [service] [region]
set -euo pipefail
cd "$(dirname "$0")/.."
SERVICE="${1:-company-brain}"
REGION="${2:-europe-west4}"
set -a; source .env; set +a
: "${GOOGLE_CLOUD_PROJECT:?GOOGLE_CLOUD_PROJECT mancante in .env}"

ENV="GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT},GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-global},GOOGLE_GENAI_USE_VERTEXAI=TRUE"
ENV+=",GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.8-flash},GEMINI_MODEL_LITE=${GEMINI_MODEL_LITE:-gemini-3.1-flash-lite}"
ENV+=",LLM_MODE=${LLM_MODE:-live},TRACE_EXPORTER=gcp,LLM_BUDGET_USD=${LLM_BUDGET_USD:-90}"
if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
  ENV+=",ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY},ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID:-},ELEVENLABS_MODEL_ID=${ELEVENLABS_MODEL_ID:-eleven_multilingual_v2}"
fi
if [[ -n "${SMTP_PASSWORD:-}" ]]; then  # real email for approved actions (only to MAIL_TO). Cloud Run allows SMTP on 587/465, not 25
  ENV+=",SMTP_HOST=${SMTP_HOST},SMTP_PORT=${SMTP_PORT:-587},SMTP_USER=${SMTP_USER},SMTP_PASSWORD=${SMTP_PASSWORD// /},MAIL_FROM=${MAIL_FROM:-},MAIL_TO=${MAIL_TO}"
fi

# min=max=1: the demo state lives in memory, so exactly one always-on instance.
gcloud run deploy "$SERVICE" --source . --project "$GOOGLE_CLOUD_PROJECT" --region "$REGION" \
  --min-instances 1 --max-instances 1 --memory 1Gi --cpu 1 --timeout 300 \
  --allow-unauthenticated --set-env-vars "$ENV"
