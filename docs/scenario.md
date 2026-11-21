# Scenario demo — Bottega Sabauda

Contesto fittizio su cui è costruito il dataset sintetico della demo: `src/data/seed/*.json` (letto dal backend; convertito dal vecchio `src/web/data.js`, che non è più aggiornato).
Gli eventi che arrivano con ▶ Avanti sono in `src/data/seed/timeline.json`. Se cambi il dataset, aggiorna anche questo file (e viceversa).

## L'azienda
**Bottega Sabauda** è un negozio online torinese **specializzato nella vendita di gianduiotti**.
Vende a utenti finali (B2C) e a negozi/bar/enoteche (B2B, listino -35%). I gianduiotti sono prodotti da un laboratorio esterno (Laboratorio Sant'Anna).

Data "di oggi" nella demo: **21/11, ~08:10**. Black Friday: 27/11.

## I 4 comparti (= i ruoli dell'app)
| Comparto (`role`) | Persona | Di cosa si occupa |
|---|---|---|
| Magazzino (`magazzino`) | Sara Conti | Arrivi dal laboratorio, scorte, lotti e quarantena, picking, packaging |
| Servizio clienti (`clienti`) | Giulia Rossi | Ticket, rimborsi, allergeni, avvisi ai clienti |
| Shop (`shop`) | Marco Bianchi | Sito, prezzi, promozioni, margini, newsletter, fornitori e pagamenti (amministrazione) |
| Spedizioni (`spedizioni`) | Davide Greco | Corrieri (BRT Italia, GLS→DHL estero), tracking, ritiri, spedizioni verso privati e negozi |

Non esistono più i ruoli finance/tech/ops della prima versione: i pagamenti ai fornitori e i margini sono in carico allo Shop.

## Catalogo (12 prodotti)
Classici 250g/500g, fondenti 70%, al latte, al caffè, al sale marino, Box Natale, Box assortiti, Calendario dell'Avvento, tavolette, crema gianduja, sfuso B2B 1kg.
Regole spedizione: Italia gratis sopra 49€ (altrimenti 5,90€); estero gratis sopra 79€ (altrimenti 11,90€). Cut-off ordini 14:00.

## Promozioni
Attive: `NATALE10` (-10% solo Box Natale, fino al 30/11), 2x1 tavolette (fino al 23/11), `CAFFE15` (-15% gianduiotti al caffè), `BENVENUTO5` (-5€ primo ordine >30€), spedizione gratis. Regola: **un solo codice per ordine**.
Programmata: Black Friday **-20%** dal 27 al 30/11 (esclusi Calendari e B2B), da non comunicare ai clienti prima del 26/11.

## Cosa contiene il dataset
| Tipo | Quantità | Note |
|---|---|---|
| Ordini | 25 (+1 live) | B2C e B2B (negozi), corriere, stato, note; totali calcolati da articoli + promo + spedizione |
| Email | 23 | fornitori (laboratorio, cooperativa nocciole, packaging), corrieri (BRT, GLS, DHL), clienti e negozi, conferme di spedizione, newsletter |
| Chat | 54 (1 live) | 6 canali: `#generale`, `#promo`, `#magazzino`, `#spedizioni`, `#clienti`, `#shop` (alcuni bloccati per ruolo) |
| Documenti | 9 | calendario promo, regole sconti, policy resi, procedura spedizioni/magazzino, FAQ allergeni, listino B2B, margini, condizioni fornitore |
| Task | 5 | cumulo codici, inventario, DHL, picking Black Friday, FAQ |
| Memoria | 14 | 10 approvati, 4 in attesa di revisione |
| Azioni proposte | 7 + 1 da evento | rimborso, pagamento fattura, blocco vendita, quarantena, avvisi clienti, intercettazione collo, riordino |

I dati sono in un unico file; le fonti hanno id mnemonici (`em-` email, `ch-` chat, `dc-` doc, `tk-` task) usati da memoria, azioni e brief per citare le fonti.

## Storie pre-piantate (cosa deve notare il Brain)
1. **Scenario trasversale — lotto L26-1108** (Gianduiotti al caffè): il laboratorio scrive alle 06:30 che l'etichetta non riporta «contiene latte». Tocca tutti: Magazzino (quarantena 202 pz), Shop (promo `CAFFE15` attiva + newsletter alle 10:00 a 8.400 iscritti), Servizio clienti (una cliente allergica ha già scritto; avviso ai 17 ordini), Spedizioni (non evadere #10487).
2. **Battuta scambiata per fatto → quarantena**: in `#generale` Marco scherza su «50% su tutto» al Black Friday; due messaggi dopo corregge (-20%). La battuta contraddice la memoria approvata `M3` (-20%): il Brain non la usa e la mette in quarantena per lo Shop.
3. **Messaggio live in contrasto** (bottone in Store): Giulia scrive in `#clienti` che «lo sconto massimo è il 30%» e lo applica all'ordine #10490, ma la memoria approvata `M15` dice 20% (max, codici e sconti manuali inclusi). Il Brain mette l'informazione in quarantena e avvisa lo Shop: *Scarta e dimentica* (fonte bandita, ordine riportato a 67,20€) oppure *Accetta* (memoria aggiornata).
4. **Cumulo codici**: `NATALE10` + `BENVENUTO5` cumulabili per un bug del checkout, 14 ordini con doppio sconto stanotte.
5. **Fornitore in ritardo + fattura scaduta**: fondenti slittano al 28/11 per il cacao; il laboratorio ricorda la fattura n. 889 (3.450€) e minaccia di rivedere le priorità. Riordino dei classici: lead time 5 giorni lavorativi → arriva il 28/11, a Black Friday iniziato.
6. **Capacità corrieri**: previsti 160 colli il 27/11, BRT concede 140 per ritiro e il secondo ritiro solo dal 26/11; BRT annuncia ritardi +24/48h in Nord-Ovest.
7. **Cambio corriere estero**: dal 1/12 DHL Express a 9,90€/collo (GLS scade il 30/11).
8. **Collo danneggiato**: P. Martin (FR, #10481), rimborso sotto i 100€ → decide il Servizio clienti; GLS riconosce il danno (max 100€).
9. **Indirizzo errato** (#10479) e **collo in giacenza** (#10476).
10. **B2B**: Dolce Vita Torino chiede 20 kg di sfuso, a magazzino ce ne sono 15.
11. **Evento simulato** (bottone in Store): un'influencer fa vendere 118 classici in un'ora → alert a Magazzino + bozza di riordino da 600 pz.
12. **Buco di conoscenza**: Sara (Magazzino) chiede «Qual è l'ordine minimo per le nocciole?». Le nocciole si comprano dalla Cooperativa Nocciola Langhe e vanno al laboratorio (`em-nocciole`), ma la regola sull'ordine minimo non è scritta da nessuna parte. Il Brain risponde «non lo so» e apre una richiesta a Marco (Shop, fornitori e acquisti), che la documenta.

## Permessi (cosa vede chi)
- Margini e report: solo Shop. Contratto fornitore e listino B2B: Shop + Magazzino. Fattura sollecito: solo Shop.
- Canali: `#generale` e `#promo` tutti; `#magazzino` Magazzino/Spedizioni/Shop; `#spedizioni` Spedizioni/Magazzino/Clienti; `#clienti` Clienti/Spedizioni/Shop; `#shop` Shop/Clienti.
- Dati personali dei clienti (reclami, indirizzi): Servizio clienti, Spedizioni, e Shop dove serve.
- L'allerta sul lotto (`em-lotto`) è visibile a tutti: è una questione di sicurezza alimentare.

## Fiducia nelle fonti: quarantena ("coda di scarto")
Il Brain **non considera vero ciò che legge**. Per ogni fonte estrae le affermazioni (`claim` in `data.js`) e le confronta con la memoria **approvata** che ha lo stesso `fact.key`:
- stesso valore o nessun confronto possibile → segue il flusso normale (proposta in memoria, da approvare);
- valore diverso → **non viene usata né proposta come memoria**: finisce in *Oggi → Da verificare* per i ruoli in `authority` della voce contraddetta (qui lo Shop), che avvisa con un messaggio proattivo;
- l'autorità sceglie **Scarta e dimentica** (fonte bandita, mai più usata; se serve si corregge l'ordine coinvolto) oppure **Accetta e aggiorna la memoria**.
Gli altri reparti vedono solo che esiste un elemento in quarantena, non il contenuto.
Nella demo l'estrazione dei `claim` è pre-annotata nei dati; con Gemini diventerà un passo del Brain (stesso formato).

## Buchi di conoscenza ("da documentare")
Quando il Brain non trova nulla nella memoria (né approvata né in revisione):
1. **Capisce se la domanda riguarda l'azienda** confrontandola con le competenze dei reparti (`TOPIC_OWNERS` in `data.js`). Se non riguarda l'azienda (es. «quanti dipendenti ha il concorrente?») dice solo «non lo so» e non apre nulla.
2. Se riguarda l'azienda, **apre una richiesta al reparto competente** (es. nocciole → Shop, che gestisce fornitori e acquisti). La persona riceve un messaggio proattivo e la richiesta compare in *Oggi → Domande dei colleghi*. Una domanda uguale già aperta non viene duplicata.
3. La persona competente scrive **il fatto** e **la domanda a cui risponde** (precompilata, modificabile) e sceglie chi può vederlo. Il fatto entra in memoria **già approvato**, perché lo firma chi ha l'autorità, ed è citato come fonte «📝 Risposta di …». Le parole chiave vengono ricavate dalla domanda e ne servono almeno 2 per far scattare la risposta.
4. Chi aveva chiesto riceve la risposta in chat. Da lì in poi il Brain la sa.
5. In alternativa la persona chiude la richiesta con «Non esiste / non è di mia competenza», e chi aveva chiesto viene avvisato.

Nella demo l'instradamento è per parole chiave; con Gemini il Brain classificherà la domanda e sceglierà il reparto (stessa struttura di `TOPIC_OWNERS`).
