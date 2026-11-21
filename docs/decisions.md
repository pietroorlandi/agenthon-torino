# Decision log

Formato: `YYYY-MM-DD — decisione — motivo`

- 2026-11-21 — Repo inizializzata con CLAUDE.md e docs — base condivisa prima dell'evento
- 2026-11-21 — Scelta Challenge A (Company Brain), scenario e-commerce "Bottega Sabauda" — dominio semplice e credibile per i 7 check
- 2026-11-21 — Scenario ridefinito: negozio online di gianduiotti con 4 comparti (magazzino, servizio clienti, shop, spedizioni); i ruoli dell'app diventano i comparti (via finance/tech/ops, 4 utenti invece di 3) — il contesto reale dell'azienda va rispecchiato nei dati demo; dettagli in docs/scenario.md
- 2026-11-21 — Dataset sintetico ampliato (25 ordini, 22 email, 53 chat, 8 doc, 5 task, 14 memorie, 7 azioni) con storie pre-piantate (lotto con allergene mancante, battuta sul 50%, cumulo codici, picco corrieri) — la demo deve mostrare Brain che collega reparti diversi
- 2026-11-21 — Quarantena delle informazioni in contrasto: le fonti non sono considerate vere; un claim che contraddice la memoria approvata non viene usato e va in coda all'autorità (ruoli `authority` della voce) che sceglie scarta/dimentica o accetta/aggiorna — evita che una chat sbagliata o una battuta avveleni la memoria condivisa
- 2026-11-21 — Step 1: UI statica in src/web (HTML/CSS/JS, zero dipendenze, dati mock) — demo sempre funzionante, motore risposte sostituibile con Gemini (askBrain in app.js)
