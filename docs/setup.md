# Guida setup — Company Brain (Bottega Sabauda)

Come far girare il progetto, dal livello "zero chiavi" fino al deploy su Cloud Run.
Ogni livello funziona da solo: se Vertex o ElevenLabs non rispondono, la demo continua con i motori deterministici (P8).

| Livello | Cosa serve | Cosa ottieni |
|---|---|---|
| **A. Offline** | Python 3.11+, Node 20.19+/22.12+ | Tutta l'app con motori deterministici (`LLM_MODE=off`): copione, quarantena, ruoli, azioni |
| **B. Gemini** | + progetto Google Cloud con crediti, `gcloud` | Triage, estrazione, Q&A e agente bozze con Gemini su Vertex |
| **C. Voce** | + chiave ElevenLabs | 🔊 Brief audio con voce ElevenLabs (senza: voce del browser) |
| **D. Deploy** | + Cloud Run | URL pubblico, tracce su Cloud Trace |

---

## 1. Prerequisiti

- **Python ≥ 3.11** (`python3 --version`) e **Node ≥ 22.12** (`node --version`).
- **gcloud CLI** (solo per i livelli B e D): https://cloud.google.com/sdk/docs/install — su Linux:
  ```bash
  curl -sSL https://sdk.cloud.google.com | bash && exec -l $SHELL && gcloud init
  ```
- Docker: opzionale (solo per provare l'immagine in locale con `make docker`).

## 2. Livello A — avvio offline (2 minuti)

```bash
make setup     # venv in src/backend/.venv, npm install, copia .env.example → .env
make dev       # FastAPI :8000 + Vite :5173 → apri http://localhost:5173
make test      # test delle garanzie (offline) + typecheck del frontend
make demo      # alternativa a un solo processo: build + http://localhost:8000
```

Con `GOOGLE_CLOUD_PROJECT` vuoto il backend va da solo in `LLM_MODE=off`. In alto a destra la UI mostra la modalità attiva.

## 3. Livello B — Gemini su Vertex AI

> ⚠️ **Solo Vertex AI, mai AI Studio**: i crediti valgono solo su Vertex. Niente chiave `GOOGLE_API_KEY`: ci si autentica con il proprio account Google (ADC).

### 3.1 Crediti
1. Il sabato mattina, con il **Gmail personale**, riscatta i crediti su **g.dev/credits/devfest-alps-2026** ($30, durano **12 ore** dal claim).
2. Il riscatto crea (o ti fa scegliere) un **billing account** con i crediti. Il saldo si aggiorna con circa 1 ora di ritardo.

### 3.2 Progetto
```bash
gcloud auth login
gcloud projects create bottega-brain-<suffisso> --name="Company Brain"     # o usa un progetto esistente
gcloud config set project bottega-brain-<suffisso>
gcloud billing accounts list                                                # trova l'ID del billing account con i crediti
gcloud billing projects link bottega-brain-<suffisso> --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud services enable aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com cloudtrace.googleapis.com logging.googleapis.com
```

### 3.3 Credenziali locali (ADC)
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project bottega-brain-<suffisso>
```

### 3.4 `.env`
```dotenv
GOOGLE_CLOUD_PROJECT=bottega-brain-<suffisso>
GOOGLE_CLOUD_LOCATION=europe-west4
LLM_MODE=live
```

### 3.5 Verifica
```bash
make check
# ✓ gemini-3.8-flash: {"ok": true, "word": "..."} · 12 in / 8 out · 900 ms
# ✓ gemini-3.1-flash-lite: ...
```

**Regione:** mai `europe-west12` (Torino) né `me-central1` (esclusi dai crediti). Se un modello risponde `404 NOT_FOUND`, prova `GOOGLE_CLOUD_LOCATION=global` (spesso i Gemini nuovi escono prima sull'endpoint globale) oppure `europe-west1`. Dopo un'ora controlla in *Billing → Reports* che il costo sia scalato dai crediti.

### 3.6 Lavorare in tre sullo stesso progetto
Il proprietario del progetto aggiunge gli altri due:
```bash
gcloud projects add-iam-policy-binding bottega-brain-<suffisso> --member=user:<gmail-collega> --role=roles/aiplatform.user
```
Il collega fa i passi 3.3 e 3.4 con lo stesso `GOOGLE_CLOUD_PROJECT`. In alternativa ognuno sviluppa sul proprio progetto con i propri crediti (i costi si dividono) e si usa un solo progetto per il deploy.

### 3.7 Costi attesi
Ogni evento della timeline fa 1–2 chiamate (triage su Flash-Lite, estrazione su 3.8 Flash); una domanda ne fa 1–2. Un giro completo del copione costa pochi centesimi. Il pannello **📊 Osservabilità** mostra il costo stimato in tempo reale contro il budget (`LLM_BUDGET_USD`), mentre il saldo Google arriva con un'ora di ritardo. I prezzi di Flash-Lite e 3.5 Flash in `app/config.py` sono stime: verificali sul listino Vertex.

### 3.8 Modalità LLM e piano B
| `LLM_MODE` | Comportamento | Quando |
|---|---|---|
| `live` | Chiama Vertex e salva ogni risposta in `src/data/llm_cache/` | Sviluppo e demo |
| `replay` | Usa solo la cache; se manca la risposta → motore deterministico | **Piano B** se Vertex cade durante il pitch |
| `off` | Mai Vertex: motori deterministici e copione | Sviluppo senza chiavi, test |

**Preparare il piano B:** prima del pitch fai girare il copione in `live` in locale (tutti i ▶ Avanti e le domande del pitch), poi committa `src/data/llm_cache/`: con `LLM_MODE=replay` la demo risponde uguale anche senza rete verso Vertex. Se cambi un prompt, la cache di quel prompt va rigenerata.

## 4. Livello C — ElevenLabs (voce del brief)

1. **Coupon:** entra nel Discord di ElevenLabs → canale `#🎟️│coupon-codes` → *Start Redemption* → evento «AGENTHON: Waiting for DevFest Alps» → email dell'iscrizione. Il bot ti manda il codice: applicalo su elevenlabs.io (*Subscription*).
2. **API key:** elevenlabs.io → *Developers → API Keys → Create*. Permessi minimi: *Text to Speech* e lettura *Voices*.
3. **Voice ID:** *Voices → Voice Library*, filtra per lingua **italiano**, *Add to My Voices*. Poi in *My Voices* → menu della voce → *Copy voice ID*.
4. `.env`:
   ```dotenv
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_VOICE_ID=...
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2   # oppure eleven_flash_v2_5: più veloce ed economico, parla italiano
   ```
5. Verifica con `make check` (riga «✓ ElevenLabs»), poi *Email del mattino → 🔊 Ascolta il brief*.

Usa sempre l'**API**, non l'app web, per far durare i crediti. L'mp3 è in cache per testo: riascoltare lo stesso brief non consuma caratteri. C'è un premio speciale per il miglior uso di ElevenLabs: vedi le idee in fondo.

## 5. Osservabilità (GenAI)

Ogni chiamata a Gemini passa da un solo punto (`app/llm.py`), che registra token, costo, latenza, uso della cache e fallback. Lo fa due volte: nei **contatori** del pannello e negli **span OpenTelemetry**, con gli attributi standard `gen_ai.*` e gli equivalenti OpenInference per Phoenix. Anche l'agente ADK produce i suoi span (agente, chiamata LLM, tool).

| Dove | Come si attiva | A cosa serve |
|---|---|---|
| **📊 Osservabilità** + **📜 Audit** nell'app | Sempre attivi | Pitch e giuria: costi, precisione dell'estrazione, % «non lo so», chi ha approvato cosa |
| Console | `TRACE_EXPORTER=console` | Debug veloce in locale (gli span finiscono su stdout) |
| **Cloud Trace** + Cloud Logging | `TRACE_EXPORTER=gcp` (già impostato da `make deploy`) | Su Cloud Run: *Trace Explorer*. I log JSON hanno il trace id, quindi dal log si salta alla traccia |
| **Phoenix** (locale, open source) | `docker run -p 6006:6006 arizephoenix/phoenix` + `TRACE_EXPORTER=otlp` + `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:6006` | Vedere prompt e risposte in una UI dedicata agli LLM (con `LOG_PROMPTS=true`) |
| **Langfuse** (cloud, gratis) | Account su cloud.langfuse.com → *Project → API keys*. Poi `TRACE_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_ENDPOINT=https://cloud.langfuse.com/api/public/otel`, `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20$(echo -n "pk-lf-...:sk-lf-..." \| base64 -w0)` | Dashboard condivisibile, utile anche dal deploy |

`LOG_PROMPTS=true` mette prompt e risposte complete negli span e nei log: tienilo solo in sviluppo. **Consiglio:** per l'hackathon bastano pannello e Cloud Trace. Phoenix va bene se vuoi vedere i prompt in locale, Langfuse solo se avanza tempo.

## 6. Livello D — Deploy su Cloud Run

Un solo servizio: il Dockerfile multi-stage compila il frontend e lo serve da FastAPI insieme alle API, quindi un solo URL e niente CORS.

### 6.1 Permessi del service account (una volta)
Cloud Run usa il service account di default di Compute Engine:
```bash
PROJECT=bottega-brain-<suffisso>
SA=$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com
for r in roles/aiplatform.user roles/cloudtrace.agent roles/logging.logWriter roles/cloudbuild.builds.builder roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$r --condition=None
done
```

### 6.2 Deploy
```bash
make deploy                    # = ./scripts/deploy.sh company-brain europe-west4
```
- La prima volta `gcloud` chiede di creare il repository Artifact Registry `cloud-run-source-deploy`: rispondi `Y`.
- Lo script legge da `.env` progetto, modelli e chiave ElevenLabs, e imposta `TRACE_EXPORTER=gcp`.
- `--min-instances 1 --max-instances 1`: lo stato della demo sta in memoria, quindi serve **una sola istanza sempre accesa**. Costa pochi dollari in 12 ore: controllali nel billing.
- Ogni nuovo deploy riparte dallo stato iniziale. Durante la demo usa il pulsante **↺ Reset**.
- La chiave ElevenLabs finisce in una variabile d'ambiente del servizio, visibile a chi ha accesso al progetto. Per un hackathon va bene; l'alternativa è Secret Manager con `--set-secrets`.

### 6.3 Prima del pitch
1. Apri l'URL, fai **Reset** e un giro completo del copione: la cache si scalda e verifichi i tempi.
2. Tieni pronto il piano B: cache committata + `LLM_MODE=replay` (§3.8), e un video registrato.

## 7. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| `403 PERMISSION_DENIED … aiplatform` | API non abilitata o ADC senza quota project | §3.2 `services enable`, §3.3 `set-quota-project` |
| `404 NOT_FOUND Publisher model` | Modello non disponibile nella regione | `GOOGLE_CLOUD_LOCATION=global` o `europe-west1` |
| `429 RESOURCE_EXHAUSTED` | Quota al minuto | Riprova tra poco; il Brain intanto usa il fallback (vedi pannello) |
| `DefaultCredentialsError` | Manca `gcloud auth application-default login` | §3.3 |
| La UI dice `LLM: off` | `GOOGLE_CLOUD_PROJECT` vuoto o `LLM_MODE=off` | Controlla `.env` e riavvia il backend |
| «Riscrivi con l'agente» disabilitato | L'agente ADK gira solo in `live` | `LLM_MODE=live` |
| 🔊 usa la voce del browser | ElevenLabs non configurato o errore | §4; l'errore è nei log del backend |
| Build Cloud Run fallisce per permessi | Service account senza ruoli di build | §6.1 |

## 8. Idee per il premio ElevenLabs (se avanza tempo)
- Una voce diversa per gli alert urgenti (quarantena, lotto non conforme) rispetto al brief.
- Domande a voce (ElevenLabs Speech-to-Text) nel DM con il Brain.
