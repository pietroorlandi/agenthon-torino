# CLAUDE.md — AGENTHON (GDG Torino)

Questo file dà contesto a Claude Code (e ai membri del team) su cosa stiamo costruendo e come lavoriamo.
Aggiornalo man mano: è la fonte di verità condivisa.

## Contesto
- Evento: **AGENTHON**, hackathon di GDG Torino, nel weekend prima della DevFest Alps.
- Team: max 3 persone. Tempo limitato: **priorità a una demo funzionante, non alla perfezione**.
- La sfida dettagliata viene svelata **solo all'apertura della giornata**. Fino ad allora tutto è provvisorio.
- Traccia parziale in [docs/brief.md](docs/brief.md); criteri in [docs/evaluation.md](docs/evaluation.md).

- Portale ufficiale: https://agenthon-portal.gdgtorino.it/app#today
- Risorse, crediti e vincoli: [docs/resources.md](docs/resources.md)

## Track: **Agentic AI per le aziende** (business) — Ariete Tech Solutions
Workflow autonomi, gestione richieste in entrata, analisi documenti, integrazione di più strumenti.
(L'altra track, Generative AI per il marketing / Demetra, non è la nostra.) La sfida dettagliata esce all'apertura.

## Scenario demo (contesto aziendale del dataset)
Il dataset sintetico della demo (`src/web/data.js`) simula **Bottega Sabauda**, negozio online torinese **specializzato nella vendita di gianduiotti**.
- **4 comparti** = i 4 ruoli dell'app: **magazzino**, **servizio clienti**, **shop** (include amministrazione/fornitori) e **spedizioni** (verso utenti finali e negozi).
- Il dataset contiene ordini (privati e negozi), email a/da fornitori, corrieri e clienti, chat tra colleghi su promozioni attive e problemi, documenti, task, memoria e azioni.
- Dettagli, storie pre-piantate e permessi: [docs/scenario.md](docs/scenario.md). **Se cambi i dati o il contesto, aggiorna quel file.**
- **Regola di prodotto — le fonti non sono verità**: il Brain confronta le nuove informazioni con la memoria approvata; se contraddicono (es. «sconto massimo 30%» vs 20% approvato) vanno in **quarantena** e le decide chi ha l'autorità (scarta e dimentica / accetta e aggiorna). Non vanno mai usate per rispondere prima. Meccanismo: `claim` sulle fonti, `fact` + `authority` sulla memoria in `data.js`; `detectConflicts()` in `app.js`.
- Data "di oggi" nella demo: 21/11 ~08:10 (Black Friday il 27/11).

## Vincoli tecnici da ricordare
- Crediti Google Cloud $30/persona, validi 12 ore dal claim (sabato mattina).
- **Gemini solo via Vertex AI** (non AI Studio: i crediti non si applicano). Modelli GA: `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`.
- **Non usare Claude/Llama come modelli del prodotto su Vertex**: probabilmente non coperti dai crediti.
- Regione: NON `europe-west12` né `me-central1`. Deploy su Cloud Run (non GKE).
- Evitare modelli Preview senza aver verificato che i crediti li coprano.
- ElevenLabs gratis (coupon) per voce via API; premio speciale per il miglior uso.

## Criteri di valutazione (guidano ogni scelta)
Innovazione · Coerenza con il brief · Fattibilità · Esecuzione · Pitch finale.
→ Il brief ufficiale va letto con attenzione e rispettato alla lettera; meglio una demo piccola e solida che un progetto ambizioso rotto.

## Stato attuale
- [x] Track scelta: Agentic AI per le aziende
- [ ] Brief ufficiale incollato in docs/brief.md
- [ ] Stack deciso: _da decidere_ (vedi sezione Stack)
- [ ] Ruoli assegnati

## Stack
_Da confermare dopo l'apertura._ Indicazione di partenza (dai crediti): Gemini su Vertex AI, Cloud Run, Firestore/Cloud Storage, Python o TypeScript, un frontend semplice per la demo. ElevenLabs per la voce se utile.
Quando lo stack è deciso, scrivi qui comandi di install/run/test.

## Struttura repo
- `src/` — codice del progetto
- `src/web/` — UI demo statica (`index.html`, `app.js`, `styles.css`) e dataset sintetico (`data.js`); si apre direttamente nel browser
- `docs/` — brief, criteri, scenario demo, decisioni, script del pitch
- `docs/decisions.md` — log delle decisioni (data, cosa, perché)
- `.env.example` — variabili richieste; i segreti reali vanno in `.env` (mai committato)

## Convenzioni di lavoro (team)
- Branch: `main` sempre funzionante per la demo. Lavora su `feat/<nome>-<cosa>`, PR piccole, merge veloci.
- Commit piccoli e frequenti; `git pull --rebase` prima di push per evitare conflitti.
- **Mai committare chiavi API o `.env`.**
- Evita conflitti: ogni persona lavora su file/cartelle diversi dove possibile.
- Decisioni importanti → una riga in `docs/decisions.md`.

## Istruzioni per Claude
- Rispondi in italiano; commenti nel codice e nomi in inglese.
- Privilegia soluzioni semplici e rapide da realizzare; niente over-engineering.
- Prima di implementare, verifica che la scelta sia coerente con il brief e i criteri di valutazione.
- Tieni sempre pronto un percorso "demo": dati di esempio, script di avvio unico, fallback se un'API fallisce.
- Non aggiungere dipendenze pesanti senza motivo; segnala cosa serve in `.env.example`.
- Aggiorna questo file e `docs/decisions.md` quando cambiano stack, track o architettura.
