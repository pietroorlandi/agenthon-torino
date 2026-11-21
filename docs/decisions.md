# Decision log

Formato: `YYYY-MM-DD — decisione — motivo`

- 2026-11-21 — Repo inizializzata con CLAUDE.md e docs — base condivisa prima dell'evento
- 2026-11-21 — Challenge A "Company Brain" — 7 check sì/no espliciti, ognuno garantibile nel codice
- 2026-11-21 — Dominio: cioccolateria torinese fittizia (gianduiotti, e-shop + B2B natalizio) — dipendenze reali fornitore→produzione→cliente, dati riservati per ruolo, urgenza Natale — **superata** dalla riga "Scenario ridefinito" (Bottega Sabauda, 4 comparti)
- 2026-11-21 — Le risposte usano solo memoria approvata; filtro ruoli prima dell'LLM; garanzie nel codice, non nel prompt — resistenza agli attacchi live (vedi docs/architecture.md §2)
- 2026-11-21 — Tempo/task a rischio calcolati in modo deterministico (orologio simulato + campi task + calendario aziendale), senza LLM
- 2026-11-21 — Triage delle fonti (trust mittente + noise/spam/suspicious/relevant) prima dell'estrazione; un evento produce 0..N item — le fonti non sono sempre affidabili
- 2026-11-21 — Memoria = record strutturati (MemoryRepo); dai coding agent prendiamo il modello (un fatto per item, update/supersede), non il meccanismo (agente che legge/scrive da solo)
- 2026-11-21 — google-genai per pipeline e Q&A; Google ADK solo per il draft agent — garanzie nel codice dove serve, autonomia dove è innocua
- 2026-11-21 — Frontend Vite + React + TS + Tailwind servito da FastAPI su un solo Cloud Run — scelta del team, un URL, niente CORS
- 2026-11-21 — Osservabilità: OpenTelemetry → Cloud Trace + Cloud Logging + pannello in app (costi, precisione estrazione) — nativo su GCP, utile anche nel pitch
- 2026-11-21 — Track B (controllo fatture FatturaPA) solo come estensione dopo il freeze dei 7 check di A — una sola classifica, A è la priorità
- 2026-11-21 — Scenario ridefinito: **Bottega Sabauda**, negozio online di gianduiotti con 4 comparti (magazzino, servizio clienti, shop, spedizioni); i ruoli dell'app diventano i comparti (via finance/tech/ops, 4 utenti invece di 3) — il contesto reale dell'azienda va rispecchiato nei dati demo; dettagli in docs/scenario.md. Sostituisce scenario e persone di docs/architecture.md §3 (Mole Cacao)
- 2026-11-21 — Dataset sintetico ampliato (25 ordini, 22 email, 53 chat, 8 doc, 5 task, 14 memorie, 7 azioni) con storie pre-piantate (lotto con allergene mancante, battuta sul 50%, cumulo codici, picco corrieri) — la demo deve mostrare Brain che collega reparti diversi
- 2026-11-21 — Quarantena delle informazioni in contrasto: le fonti non sono considerate vere; un claim che contraddice la memoria approvata non viene usato e va in coda all'autorità (ruoli `authority` della voce) che sceglie scarta/dimentica o accetta/aggiorna — evita che una chat sbagliata o una battuta avveleni la memoria condivisa
- 2026-11-21 — Buchi di conoscenza: un «non lo so» su un tema aziendale apre una richiesta «da documentare» al reparto competente, che scrive fatto + domanda; il fatto entra in memoria già approvato perché lo firma chi ha l'autorità — la memoria cresce dalle domande reali e non solo dalle fonti osservate. Domande fuori perimetro: nessuna richiesta
- 2026-11-21 — Step 1: UI statica in src/web (HTML/CSS/JS, zero dipendenze, dati mock) — demo sempre funzionante, motore risposte sostituibile con Gemini (askBrain in app.js)
