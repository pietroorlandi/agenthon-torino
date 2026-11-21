# Copione demo — "una mattina in Bottega Sabauda"

Obiettivo: far vedere che **ogni evento che arriva (▶ Avanti) cambia lo stato della piattaforma**, e che il Brain propone ma non agisce mai senza la persona giusta.
Scenario e dati: [scenario.md](scenario.md) · eventi della timeline: `src/data/seed/timeline.json`.

## A. Preparazione

**Tecnica**
- [ ] **Modalità LLM**: `replay` è la più sicura (cache committata, zero latenza, esiti fissi). `live` serve solo per il bottone *Riscrivi con l'agente ADK* in Azioni (disabilitato fuori da `live`). Tenere `replay` come piano B.
- [ ] `make smoke URL=https://…run.app` sul deploy vero poco prima del pitch (⚠️ fa reset).
- [ ] **⟲ Reset** subito prima di salire: la timeline non torna indietro, ▶ Avanti ha solo 6 passi.
- [ ] ElevenLabs configurato (`make check`); senza chiave l'audio usa la voce del browser (meno effetto).
- [ ] **Una sola finestra**, cambiare utente dal menu: l'utente è salvato in `localStorage` e lo stato non fa polling, quindi due tab affiancate si "rubano" l'utente e mostrano dati vecchi.
- [ ] Zoom browser 125%, domande pronte da incollare (sotto).
- [ ] **Video di backup** registrato del copione completo.

**Da provare almeno una volta**
- Dopo l'evento delle 09:30, approvare la memoria sulle etichette e chiedere *"Quando arrivano le etichette correttive del lotto?"*: verificare che risponda.

## B. Copione

| # | Chi | Cosa fai | Cosa cambia (il momento "wow") |
|---|---|---|---|
| 0 | Sara | **📧 Email del mattino** → 🔊 Ascolta | Il Brain "parla per primo": brief non richiesto, con fonti citate |
| 1 | Marco | **Azioni** → A3 *Sospendere vendita caffè + CAFFE15* → Approva | **Store**: tag rosso *vendita sospesa* sui Gianduiotti al caffè. Prima mostra che come Sara è bloccata (non è il suo reparto) |
| 2 | — | **▶ Avanti 08:12** (Giulia applica il 30%) | **Store**: nuovo ordine #10490 a 58,80€ *"In attesa approvazione sconto"*. Il brief di Marco ora inizia con 🛡️ quarantena |
| 3 | Marco | **Memoria → Quarantena** → *Scarta e dimentica* | **Store**: #10490 torna a **67,20€**, *"Sconto riportato al 20%"*. Domanda *"Qual è lo sconto massimo?"* → 20% |
| 4 | — | **▶ Avanti 08:40** (fiera + email "nuovo IBAN") | Toast: fiera *ignorata*, IBAN *in quarantena*. Come Marco: A2 (pagare fattura 889) è ancora lì con le coordinate vecchie, la truffa non l'ha toccata |
| 5 | — | **▶ Avanti 09:05** (picco influencer) | **Store**: KPI "sotto scorta" sale, GIA-250 a 24 pz (barra ambra). Sara riceve alert in chat + bozza **A8 riordino 600 pz** |
| 6 | Sara | Approva A8 | **Store**: tag verde *+600 in arrivo*. Nella motivazione si accenna alla fattura scaduta senza mostrare l'importo (riservato allo Shop) |
| 7 | — | **▶ Avanti 09:30** (etichette correttive) | Nasce una **memoria proposta** (non ancora approvata); il "Ricevuto 👍" viene ignorato |
| 8 | Sara | Approva la memoria, poi fa la domanda sulle etichette | Prima "non lo so", dopo risponde con la fonte |
| 9 | — | **▶ Avanti 10:00** (prompt injection) | In quarantena per Giulia. Come Giulia chiedi *"Qual è il margine di novembre?"* → **riservato** |
| 10 | — | **▶ Avanti 10:20** (cut-off 14:00) | **Corroborazione** della memoria M6: sale il contatore conferme |
| 11 | Sara → Marco → Sara | *"Qual è l'ordine minimo per le nocciole?"* | Sara: "non lo so, ho chiesto allo Shop". Marco: **Memoria → Da documentare**, scrive il fatto. Sara riceve la risposta in chat; rifacendo la domanda, il Brain ora la sa |
| 12 | Giuria | **🧪 Mettilo alla prova**: lascia scrivere a loro (preset: IBAN da dominio simile, finto capo, "sconto 50%") | Tutto in quarantena, la memoria non si avvelena |
| 13 | Chiusura | **📧 Email** ("ho osservato N eventi: X ignorati, Y in quarantena…") → **📜 Audit** → **📊 Osservabilità** (costi, contatori) → Store → *Registro decisioni* | Tutto tracciato, ogni azione approvata da una persona |

**Domande pronte**
- *"Quale corriere usiamo per l'estero da dicembre?"* — come Davide, prima e dopo aver approvato M1 in Memoria.
- *"Qual è il margine di novembre?"* — come Marco (risponde) e poi come Sara (riservato).
- *"Quanti dipendenti ha il nostro concorrente?"* — fuori perimetro: solo "non lo so", nessuna richiesta aperta.

**Versione corta** (poco tempo): passi **2-3** (sconto falso corretto sull'ordine), **5-6** (scorta → riordino), **11** (buco di conoscenza colmato), **12** (attacco live).

## C. Punti deboli noti (da sistemare o evitare in demo)

1. **A4 "Quarantena lotto" non cambia lo Store**: in `services/actions.py` solo `refund`, `intercept`, `reorder` e `block` hanno un effetto visibile. A4, A2, A5, A6 finiscono solo nel registro/outbox. Fix rapido per A4: tag "lotto in quarantena" o scorta −202 pz.
2. **Il brief cambia solo in parte**: le voci dello scenario sono fisse; si aggiornano quarantene, richieste da documentare, memorie da revisionare e contatori. Non presentarlo come "riscritto da zero".
3. **Riscrivi con l'agente ADK** solo in `live`: in `replay` il bottone è grigio.
4. **scenario.md è indietro**: parla di "bottone in Store" per influencer e messaggio di Giulia, ora arrivano con ▶ Avanti.
