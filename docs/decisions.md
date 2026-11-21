# Decision log

Formato: `YYYY-MM-DD — decisione — motivo`

- 2026-11-21 — Repo inizializzata con CLAUDE.md e docs — base condivisa prima dell'evento
- 2026-11-21 — Challenge A "Company Brain" — 7 check sì/no espliciti, ognuno garantibile nel codice
- 2026-11-21 — Dominio: cioccolateria torinese fittizia (gianduiotti, e-shop + B2B natalizio) — dipendenze reali fornitore→produzione→cliente, dati riservati per ruolo, urgenza Natale
- 2026-11-21 — Le risposte usano solo memoria approvata; filtro ruoli prima dell'LLM; garanzie nel codice, non nel prompt — resistenza agli attacchi live (vedi docs/architecture.md §2)
- 2026-11-21 — Tempo/task a rischio calcolati in modo deterministico (orologio simulato + campi task + calendario aziendale), senza LLM
- 2026-11-21 — Triage delle fonti (trust mittente + noise/spam/suspicious/relevant) prima dell'estrazione; un evento produce 0..N item — le fonti non sono sempre affidabili
- 2026-11-21 — Memoria = record strutturati (MemoryRepo); dai coding agent prendiamo il modello (un fatto per item, update/supersede), non il meccanismo (agente che legge/scrive da solo)
- 2026-11-21 — google-genai per pipeline e Q&A; Google ADK solo per il draft agent — garanzie nel codice dove serve, autonomia dove è innocua
- 2026-11-21 — Frontend Vite + React + TS + Tailwind servito da FastAPI su un solo Cloud Run — scelta del team, un URL, niente CORS
- 2026-11-21 — Osservabilità: OpenTelemetry → Cloud Trace + Cloud Logging + pannello in app (costi, precisione estrazione) — nativo su GCP, utile anche nel pitch
- 2026-11-21 — Track B (controllo fatture FatturaPA) solo come estensione dopo il freeze dei 7 check di A — una sola classifica, A è la priorità
