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

**Progetto del team:** `bottega-brain-1121-21996` (owner: Pietro, fatturazione «GDP Event Credit: DevFest Alps 2026», crediti fino al 22/11 ore 2:05). Endpoint Vertex: **`GOOGLE_CLOUD_LOCATION=global`**, perché su `europe-west4` i modelli Gemini 3.x rispondono `404 NOT_FOUND`.

### 3.1 Sei un collega: usa il progetto del team (2 minuti)
1. Installa `gcloud` (§1) e manda a Pietro il Gmail con cui farai il login.
2. Pietro ti dà l'accesso:
   ```bash
   bash scripts/gcp-add-member.sh <gmail-collega>
   ```
3. Tu lanci:
   ```bash
   bash scripts/gcp-join.sh bottega-brain-1121-21996
   make check
   ```
   Lo script fa il login, imposta le credenziali locali (ADC) e scrive `GOOGLE_CLOUD_PROJECT` e `GOOGLE_CLOUD_LOCATION=global` nella `.env`.

Le chiamate dei colleghi usano i crediti di Pietro. I tuoi $30 restano liberi: riscattali solo se servono, ad esempio quando i crediti di Pietro finiscono o per un secondo progetto di deploy. In quel caso segui il §3.2.

### 3.2 Creare un progetto nuovo da zero (solo l'owner)
1. **Crediti:** con il Gmail personale, iscriviti al **Google Developer Program** (developers.google.com/profile → *Join the program*). Poi riscatta su **g.dev/credits/devfest-alps-2026** ($30, durano **12 ore** dal claim). Il riscatto crea un billing account «GDP Event Credit», **senza carta**. Se una pagina ti chiede la carta, sei nel flusso sbagliato: la prova da $300 o *Aggiungi account di fatturazione* non sono i crediti dell'evento.
2. Il billing account compare in console entro ~5 minuti. Verifica con `gcloud billing accounts list`.
3. Lancia:
   ```bash
   bash scripts/gcp-setup.sh      # crea il progetto, collega la fatturazione, abilita le API, ADC, .env
   make check
   ```
   Lo script si può rilanciare: se i crediti non ci sono ancora si ferma, e alla volta dopo riparte dallo stesso progetto (l'ID è salvato in `.gcp-project`, ignorato da git).

### 3.3 Problemi frequenti
| Errore | Soluzione |
|---|---|
| `bash: suffisso: No such file or directory` | Hai copiato un placeholder `<...>`: usa gli script, che non ne hanno |
| `Listed 0 items` / `No billing account found` | Crediti non riscattati, o riscattati con un altro account, o manca *Join the program*. Aspetta 5 minuti e rilancia |
| `cloud-platform scope is required but not consented` | Nel browser, al login, spunta **tutte** le caselle dei permessi (anche Google Cloud) e rilancia lo script |
| `404 NOT_FOUND ... publishers/google/models/gemini-...` | `GOOGLE_CLOUD_LOCATION=global` nella `.env` |
| `403 PERMISSION_DENIED` (collega) | L'owner non ha ancora lanciato `gcp-add-member.sh` con il tuo Gmail |

Esempio di `make check` riuscito:
```
project=bottega-brain-1121-21996 location=global mode=live
✓ gemini-3.8-flash: {"ok":true,"word":"meraviglia"} · 78 in / 11 out · 5028 ms
✓ gemini-3.1-flash-lite: {"ok": true, "word": "melodia"} · 78 in / 12 out · 826 ms
```

**Regione:** mai `europe-west12` (Torino) né `me-central1` (esclusi dai crediti). Vertex usa `global`, mentre Cloud Run resta su `europe-west4` (`REGION` nel Makefile). Dopo un'ora controlla in *Billing → Reports* che il costo sia scalato dai crediti.

### 3.4 Costi attesi
Ogni evento della timeline fa 1–2 chiamate (triage su Flash-Lite, estrazione su 3.8 Flash); una domanda ne fa 1–2. Un giro completo del copione costa pochi centesimi. Il pannello **📊 Osservabilità** mostra il costo stimato in tempo reale contro il budget (`LLM_BUDGET_USD`), mentre il saldo Google arriva con un'ora di ritardo. I prezzi di Flash-Lite e 3.5 Flash in `app/config.py` sono stime: verificali sul listino Vertex.

### 3.5 Modalità LLM e piano B
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
PROJECT=bottega-brain-1121-21996
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
2. Tieni pronto il piano B: cache committata + `LLM_MODE=replay` (§3.5), e un video registrato.

## 7. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| `403 PERMISSION_DENIED … aiplatform` | API non abilitata o ADC senza quota project | Collega: §3.1 (`gcp-add-member.sh`). Owner: rilancia `scripts/gcp-setup.sh` |
| `404 NOT_FOUND Publisher model` | Modello non disponibile nella regione | `GOOGLE_CLOUD_LOCATION=global` (default) |
| `429 RESOURCE_EXHAUSTED` | Quota al minuto | Riprova tra poco; il Brain intanto usa il fallback (vedi pannello) |
| `DefaultCredentialsError` | Manca `gcloud auth application-default login` | Rilancia `gcp-join.sh` o `gcp-setup.sh` |
| La UI dice `LLM: off` | `GOOGLE_CLOUD_PROJECT` vuoto o `LLM_MODE=off` | Controlla `.env` e riavvia il backend |
| «Riscrivi con l'agente» disabilitato | L'agente ADK gira solo in `live` | `LLM_MODE=live` |
| 🔊 usa la voce del browser | ElevenLabs non configurato o errore | §4; l'errore è nei log del backend |
| Build Cloud Run fallisce per permessi | Service account senza ruoli di build | §6.1 |

## 8. Idee per il premio ElevenLabs (se avanza tempo)
- Una voce diversa per gli alert urgenti (quarantena, lotto non conforme) rispetto al brief.
- Domande a voce (ElevenLabs Speech-to-Text) nel DM con il Brain.
