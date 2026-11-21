# CLAUDE.md — AGENTHON (GDG Torino)

Questo file dà contesto a Claude Code (e ai membri del team) su cosa stiamo costruendo e come lavoriamo.
Aggiornalo man mano: è la fonte di verità condivisa.

## Contesto
- Evento: **AGENTHON**, hackathon di GDG Torino, nel weekend prima della DevFest Alps.
- Team: max 3 persone. Tempo limitato: **priorità a una demo funzionante, non alla perfezione**.
- La sfida dettagliata viene svelata **solo all'apertura della giornata**. Fino ad allora tutto è provvisorio.
- Traccia parziale in [docs/brief.md](docs/brief.md); criteri in [docs/evaluation.md](docs/evaluation.md).

## Track (ne sceglieremo UNA all'apertura)
1. **Agentic AI per le aziende** (Ariete Tech Solutions): workflow autonomi, gestione richieste in entrata, analisi documenti, integrazione di più strumenti.
2. **Generative AI per il marketing** (Demetra): modelli generativi per testo, grafica e video.

## Criteri di valutazione (guidano ogni scelta)
Innovazione · Coerenza con il brief · Fattibilità · Esecuzione · Pitch finale.
→ Il brief ufficiale va letto con attenzione e rispettato alla lettera; meglio una demo piccola e solida che un progetto ambizioso rotto.

## Stato attuale
- [ ] Track scelta: _da decidere_
- [ ] Brief ufficiale incollato in docs/brief.md
- [ ] Stack deciso: _da decidere_ (vedi sezione Stack)
- [ ] Ruoli assegnati

## Stack
_TBD dopo l'apertura._ Candidati ragionevoli: Python o TypeScript, API Claude/Gemini (GDG → probabile affinità con l'ecosistema Google), un frontend semplice per la demo.
Quando lo stack è deciso, scrivi qui comandi di install/run/test.

## Struttura repo
- `src/` — codice del progetto
- `docs/` — brief, criteri, decisioni, script del pitch
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
