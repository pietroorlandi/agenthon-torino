# AGENTHON — GDG Torino

Progetto del nostro team per AGENTHON (track: Agentic AI per le aziende).

## Cos'è
_Descrizione in una frase, da compilare dopo l'apertura._

## Team
- _Nome 1_
- _Nome 2_
- _Nome 3_

## Demo attuale (step 1)
Company Brain per **Bottega Sabauda**, negozio online di gianduiotti con 4 comparti (magazzino, servizio clienti, shop, spedizioni). UI statica con dataset sintetico: apri `src/web/index.html` nel browser (nessuna installazione). Vedi [docs/scenario.md](docs/scenario.md).

## Avvio rapido
```bash
make setup   # dipendenze Python e Node, crea .env
make dev     # http://localhost:5173 (funziona anche senza chiavi: LLM_MODE=off)
make test
```
Configurazione di Vertex AI, ElevenLabs, osservabilità e deploy su Cloud Run: [docs/setup.md](docs/setup.md).

## Documentazione
- [CLAUDE.md](CLAUDE.md) — contesto per Claude Code e il team
- [docs/brief.md](docs/brief.md) — traccia
- [docs/resources.md](docs/resources.md) — crediti Google Cloud, ElevenLabs, vincoli
- [docs/setup.md](docs/setup.md) — guida setup (API, servizi, deploy)
- [docs/architecture.md](docs/architecture.md) — architettura
- [docs/scenario.md](docs/scenario.md) — contesto aziendale e dataset sintetico della demo
- [docs/evaluation.md](docs/evaluation.md) — criteri e checklist
- [docs/decisions.md](docs/decisions.md) — decisioni
