# Company Brain · Bottega Sabauda

**Un'AI di cui il team si può fidare.** Legge email, chat, documenti e task dell'azienda, ne ricava ciò che serve sapere e prepara il lavoro. Però non dà per vero quello che legge, dice «non lo so» invece di inventare e non fa niente senza l'approvazione della persona giusta.

Progetto del nostro team per **AGENTHON** (GDG Torino), track *Agentic AI per le aziende* (Ariete Tech Solutions), Challenge A «Company Brain». Tema della track: *Build an AI your team would trust*.

## L'idea in breve

Ogni azienda ha conoscenza sparsa: una regola sta in una chat, un'eccezione in un'email, una scadenza in un task. Il Company Brain:

1. **osserva** ogni nuova fonte (email, messaggio, documento, task) e ne estrae i fatti utili;
2. **confronta** i fatti con la memoria che il team ha già approvato. Ciò che la contraddice va in **quarantena** e lo decide chi ne ha l'autorità;
3. **risponde** alle domande usando solo la memoria approvata, **citando le fonti** e rispettando chi può vedere cosa;
4. **ammette ciò che non sa**: se manca un'informazione aziendale, la chiede al reparto competente e, una volta documentata, la ricorda per tutti;
5. **prepara azioni** (rimborsi, riordini, avvisi ai clienti…) come bozze. **Nessuna parte senza approvazione umana.**

Il modello (Gemini) compare solo in pochi punti precisi: triage, estrazione, risposte, bozze e brief. Cosa entra in memoria, cosa va in quarantena e cosa viene eseguito lo decidono il codice o una persona.

## Lo scenario della demo

**Bottega Sabauda** è un negozio online torinese (immaginario) che vende gianduiotti a privati e negozi, a pochi giorni dal Black Friday. Il dataset è sintetico: ordini, email con fornitori e corrieri, chat tra colleghi, documenti e task.

L'app si usa impersonando uno dei 4 reparti (menu in alto a destra). Ognuno vede solo ciò che gli compete:

| Persona | Reparto | Di cosa si occupa |
|---|---|---|
| Sara Conti | Magazzino | scorte, lotti, picking, packaging |
| Giulia Rossi | Servizio clienti | ticket, rimborsi, allergeni, avvisi ai clienti |
| Marco Bianchi | Shop | sito, prezzi, promozioni, margini, fornitori e pagamenti |
| Davide Greco | Spedizioni | corrieri, tracking, ritiri |

Nel dataset ci sono storie da far notare al Brain, per esempio un lotto con l'etichetta senza allergene, una battuta su uno «sconto 50%» presa per vera, un'email con un «nuovo IBAN» sospetto e un picco di vendite da influencer. L'elenco completo è in [docs/scenario.md](docs/scenario.md).

## Cosa trovi nell'app

**Le schede di chi lavora**
- **Oggi**: cosa devo decidere (azioni da approvare, informazioni in quarantena, domande dei colleghi, nuove informazioni da confermare) e un riassunto scritto da Gemini, con le fonti. Il pulsante *Ascolta* legge il brief ad alta voce (ElevenLabs).
- **Chat**: si fanno domande al Brain, che risponde dalla memoria approvata (con le fonti), dice «riservato» o dice «non lo so». Ci sono anche i canali del team simulato.
- **Posta**: la casella simulata, con il brief del mattino.
- **Cosa sappiamo**: la memoria del proprio reparto e quella condivisa.

**Gli strumenti Dev/demo** (pulsante *Dev* in alto)
- **▶ Avanti**: fa arrivare l'evento successivo della mattinata e mostra come cambia lo stato. **Reset** riporta tutto all'inizio, **Nuovo giorno** passa al giorno dopo.
- **Brain**: lo stato completo della memoria e un banco di prova delle domande.
- **Store**: il negozio simulato (ordini, scorte, prodotti), su cui si vedono gli effetti delle azioni approvate.
- **Mettilo alla prova**: si scrive un'email o un messaggio d'attacco (prompt injection, IBAN falso, finto capo) e si guarda come viene trattato.
- **Audit** e **Osservabilità**: il registro delle decisioni, le chiamate al modello, i costi e la qualità dell'agente.

## Provarlo in locale

Servono **Python ≥ 3.11** e **Node ≥ 22.12**.

```bash
make setup   # venv Python + npm install + crea .env da .env.example
make dev     # backend :8000 + frontend :5173 → apri http://localhost:5173
```

**Funziona anche senza chiavi.** Se `GOOGLE_CLOUD_PROJECT` è vuoto il backend usa motori deterministici (`LLM_MODE=off`). Le modalità sono tre:

| `LLM_MODE` | Cosa fa | Quando usarla |
|---|---|---|
| `live` | chiama Gemini su Vertex AI | sviluppo, demo con il modello vero |
| `replay` | usa solo le risposte salvate in `src/data/llm_cache/` | demo senza costi né rete, risultati fissi |
| `off` | nessun LLM, testi di riserva | senza credenziali |

Per configurare Vertex AI, ElevenLabs, l'email reale, l'osservabilità e il deploy su Cloud Run c'è la guida [docs/setup.md](docs/setup.md). Su Windows, senza `make`: `powershell -ExecutionPolicy Bypass -File scripts\win.ps1 <setup|dev|test|smoke|check>`.

### Un giro di 5 minuti
1. Come **Sara (Magazzino)** apri *Oggi*: il Brain ha già letto le fonti della notte e ti dice cosa decidere.
2. In *Chat* chiedi «Qual è il margine di novembre?»: è **riservato** allo Shop. Poi chiedi «Qual è l'ordine minimo per le nocciole?»: il Brain **non lo sa** e lo chiede a Marco.
3. Attiva *Dev* e premi **▶ Avanti**: Giulia applica uno sconto del 30% che contraddice la regola approvata (20%).
4. Passa a **Marco (Shop)**: in *Oggi → Da verificare* trovi l'informazione in quarantena. *Scarta* e l'ordine torna al prezzo corretto. Da qui rispondi anche alla domanda di Sara.
5. Apri *Mettilo alla prova* e prova a ingannarlo.

Il copione completo della demo è in [docs/demo-script.md](docs/demo-script.md), i casi d'uso da provare in [docs/casi-uso.md](docs/casi-uso.md).

## Comandi

```bash
make setup    # dipendenze e .env
make dev      # sviluppo con reload: http://localhost:5173
make demo     # build + un solo processo: http://localhost:8000
make test     # test delle garanzie e del red team (offline) + typecheck del frontend
make smoke    # copione + attacchi via HTTP sul server acceso (URL=https://... per Cloud Run). Resetta la demo
make check    # verifica Vertex AI ed ElevenLabs con la .env
make deploy   # deploy su Cloud Run
```

Ogni attacco che durante il red teaming riesce a passare diventa un nuovo test in `src/backend/tests/test_redteam.py`.

## Come è fatto

- **Backend**: Python + FastAPI. Gemini via Vertex AI (`google-genai`): `gemini-3.8-flash` per estrazione, risposte e testi, `gemini-3.1-flash-lite` per il triage. Google ADK solo per l'agente che riscrive le bozze, con strumenti in sola lettura. Tutti gli output del modello passano da un validatore che controlla che numeri, IBAN, email e link compaiano davvero nelle fonti.
- **Frontend**: Vite + React + TypeScript + Tailwind CSS.
- **Voce**: ElevenLabs per il brief audio (se manca la chiave si usa la voce del browser).
- **Osservabilità**: OpenTelemetry (Cloud Trace o Langfuse/Phoenix), log JSON e un pannello in app con costi e qualità.
- **Deploy**: un solo servizio Cloud Run (Dockerfile multi-stage). Lo stato è in memoria e si carica dai seed, con reset.

Lo schema del flusso (fonte → memoria → risposta → azione) è in [docs/flow.md](docs/flow.md), l'architettura completa in [docs/architecture.md](docs/architecture.md).

```
src/
  backend/app/     API FastAPI, store per ruolo, pipeline (trust, triage, estrazione, riconciliazione), services, agente ADK
  backend/tests/   garanzie, red team, automatismi
  frontend/src/    app React (una vista per scheda in views/)
  data/seed/       dataset della demo (JSON): azienda, store, fonti, memoria, azioni, timeline
  data/llm_cache/  risposte Gemini salvate, per la modalità replay
  web/             prima versione statica (non più aggiornata)
docs/              brief, scenario, architettura, flusso, setup, copione, decisioni
scripts/           avvio, smoke test, deploy
```

## Documentazione

| File | Contenuto |
|---|---|
| [docs/brief.md](docs/brief.md) | la traccia ufficiale dell'hackathon |
| [docs/evaluation.md](docs/evaluation.md) | criteri di valutazione |
| [docs/scenario.md](docs/scenario.md) | l'azienda, i ruoli, le storie nascoste nel dataset, i permessi |
| [docs/flow.md](docs/flow.md) | schema del flusso (anche per le slide) |
| [docs/architecture.md](docs/architecture.md) | architettura e scelte tecniche |
| [docs/casi-uso.md](docs/casi-uso.md) | casi d'uso da provare, compresi gli attacchi |
| [docs/demo-script.md](docs/demo-script.md) | copione della demo per il pitch |
| [docs/setup.md](docs/setup.md) | setup di Vertex AI, ElevenLabs, email, osservabilità e deploy |
| [docs/resources.md](docs/resources.md) | crediti e vincoli dell'evento |
| [docs/decisions.md](docs/decisions.md) | registro delle decisioni |
| [CLAUDE.md](CLAUDE.md) | contesto condiviso per il team e per Claude Code |

## Team

- Pietro Orlandi
- Christian Palladino
- Marco Capaldo
