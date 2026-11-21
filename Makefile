# Company Brain — comandi del team. Guida completa: docs/setup.md
PY := src/backend/.venv/bin/python
SERVICE ?= company-brain
REGION ?= europe-west4

.PHONY: setup dev demo test smoke check build docker deploy

setup:            ## venv Python + dipendenze frontend
	test -d src/backend/.venv || python3 -m venv src/backend/.venv
	$(PY) -m pip install -q -r src/backend/requirements-dev.txt
	cd src/frontend && npm install --no-audit --no-fund
	test -f .env || cp .env.example .env

dev:              ## backend :8000 (reload) + Vite :5173 → apri http://localhost:5173
	./scripts/dev.sh

demo: build       ## un solo processo: build frontend + FastAPI su http://localhost:8000
	cd src/backend && .venv/bin/uvicorn app.main:app --port 8000

test:             ## test delle garanzie (offline, LLM_MODE=off)
	cd src/backend && .venv/bin/python -m pytest -q
	cd src/frontend && npx tsc --noEmit

smoke:            ## copione + attacchi via HTTP sul server acceso (URL=https://... per Cloud Run). Resetta la demo
	$(PY) scripts/smoke.py $(URL)

check:            ## verifica Vertex + ElevenLabs con la configurazione di .env
	cd src/backend && .venv/bin/python check_vertex.py

build:
	cd src/frontend && npm run build

docker:           ## immagine locale (stesso Dockerfile di Cloud Run) su http://localhost:8080
	docker build -t $(SERVICE) .
	docker run --rm -p 8080:8080 --env-file .env -e LLM_MODE=off $(SERVICE)

deploy:           ## deploy su Cloud Run (vedi docs/setup.md §6 per le variabili)
	./scripts/deploy.sh $(SERVICE) $(REGION)
