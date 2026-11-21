# One Cloud Run service: build the Vite frontend, then a Python image serving API + static files.
FROM node:22-slim AS web
WORKDIR /web
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src/frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 \
    SEED_DIR=/app/data/seed LLM_CACHE_DIR=/app/data/llm_cache STATIC_DIR=/app/static
WORKDIR /app
COPY src/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src/backend/app ./app
COPY src/data ./data
COPY --from=web /web/dist ./static
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
