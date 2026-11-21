// Synthetic dataset for "Bottega Sabauda" — fictional Turin online shop specialised in gianduiotti.
// Context and planted scenarios are documented in docs/scenario.md (keep the two in sync).
// Everything the Company Brain "watches" lives here. Step 2 will replace the
// answer engine with Gemini, but this data stays as the demo dataset.
//
// "Today" in the demo is 21/11, ~08:10. Black Friday is 27/11.

// ---------- team: one person per department (role = department) ----------
const USERS = {
  sara:   { id: "sara",   name: "Sara Conti",    role: "magazzino",  roleLabel: "Magazzino",        avatar: "SC", color: "#3dbb7a" },
  giulia: { id: "giulia", name: "Giulia Rossi",  role: "clienti",    roleLabel: "Servizio clienti", avatar: "GR", color: "#e8a33d" },
  marco:  { id: "marco",  name: "Marco Bianchi", role: "shop",       roleLabel: "Shop",             avatar: "MB", color: "#3d8be8" },
  davide: { id: "davide", name: "Davide Greco",  role: "spedizioni", roleLabel: "Spedizioni",       avatar: "DG", color: "#9b59d0" },
};

const ROLE_LABELS = { magazzino: "Magazzino", clienti: "Servizio clienti", shop: "Shop", spedizioni: "Spedizioni", all: "Tutti" };

// Chat channels and who may read them (department channels are partly shared, a few are locked per role).
const CHANNELS = [
  { id: "generale",   access: ["all"] },
  { id: "promo",      access: ["all"] },
  { id: "magazzino",  access: ["magazzino", "spedizioni", "shop"] },
  { id: "spedizioni", access: ["spedizioni", "magazzino", "clienti"] },
  { id: "clienti",    access: ["clienti", "spedizioni", "shop"] },
  { id: "shop",       access: ["shop", "clienti"] },
];
const channelAccess = (id) => CHANNELS.find((c) => c.id === id).access;

// ---------- store data (what the online shop admin shows) ----------
const PRODUCTS = [
  { sku: "GIA-250", name: "Gianduiotti classici 250g",            price: 12.9, stock: 142, threshold: 120, sold7d: 410 },
  { sku: "GIA-500", name: "Gianduiotti classici 500g",            price: 23.9, stock: 64,  threshold: 50,  sold7d: 168 },
  { sku: "GIA-FON", name: "Gianduiotti fondenti 70% 250g",        price: 13.9, stock: 38,  threshold: 60,  sold7d: 131 },
  { sku: "GIA-LAT", name: "Gianduiotti al latte 250g",            price: 12.9, stock: 96,  threshold: 50,  sold7d: 87 },
  { sku: "GIA-CAF", name: "Gianduiotti al caffè 200g",            price: 13.5, stock: 210, threshold: 40,  sold7d: 19 },
  { sku: "GIA-SAL", name: "Gianduiotti al sale marino 200g",      price: 13.5, stock: 55,  threshold: 30,  sold7d: 42 },
  { sku: "BOX-NAT", name: "Box Natale 600g",                      price: 34.0, stock: 88,  threshold: 80,  sold7d: 120 },
  { sku: "BOX-ASS", name: "Box assortiti 1kg",                    price: 42.0, stock: 31,  threshold: 40,  sold7d: 52 },
  { sku: "AVV-CAL", name: "Calendario dell'Avvento gianduiotti",  price: 29.9, stock: 120, threshold: 60,  sold7d: 74 },
  { sku: "TAV-GIA", name: "Tavoletta gianduja 100g",              price: 4.5,  stock: 300, threshold: 100, sold7d: 205 },
  { sku: "CRE-GIA", name: "Crema gianduja 300g",                  price: 8.9,  stock: 150, threshold: 40,  sold7d: 60 },
  { sku: "GIA-B2B", name: "Gianduiotti classici sfusi 1kg (B2B)", price: 33.5, stock: 15,  threshold: 20,  sold7d: 22 },
];
const priceOf = (sku) => PRODUCTS.find((p) => p.sku === sku).price;

// Orders. Raw rows: [id, date, customer, country, kind, items, promo codes, status, carrier, flag, total override (B2B)].
// Totals are computed from items + promos + shipping rules (IT: free ≥49€, else 5,90€ · abroad: free ≥79€, else 11,90€).
const ORDER_ROWS = [
  ["#10465", "14/11 10:20", "E. Fabbri",        "IT", "B2C", [["GIA-CAF", 1], ["GIA-250", 1]],            [],                        "Consegnato",        "BRT", "Lotto L26-1108"],
  ["#10466", "14/11 16:05", "R. Conti",         "IT", "B2C", [["BOX-NAT", 1], ["TAV-GIA", 2]],            ["NATALE10"],              "Consegnato",        "BRT"],
  ["#10467", "15/11 09:12", "H. Müller",        "DE", "B2C", [["GIA-500", 2]],                            [],                        "Consegnato",        "GLS"],
  ["#10468", "15/11 20:44", "T. Esposito",      "IT", "B2C", [["AVV-CAL", 1], ["GIA-LAT", 1]],            ["BENVENUTO5"],            "Consegnato",        "BRT"],
  ["#10469", "16/11 11:30", "Caffè Vittoria",   "IT", "B2B", [["GIA-B2B", 6], ["TAV-GIA", 24]],           [],                        "Consegnato",        "BRT", "Reclamo: 2 scatole mancanti", 271.2],
  ["#10470", "17/11 08:55", "A. Greco",         "IT", "B2C", [["GIA-FON", 2], ["GIA-SAL", 1]],            [],                        "Consegnato",        "BRT"],
  ["#10471", "17/11 19:02", "S. Bruno",         "IT", "B2C", [["GIA-250", 1]],                            [],                        "Consegnato",        "BRT"],
  ["#10472", "18/11 09:40", "Enoteca del Borgo","IT", "B2B", [["BOX-ASS", 12]],                           [],                        "Spedito",           "BRT", "", 327.6],
  ["#10473", "18/11 12:15", "J. Dupont",        "FR", "B2C", [["BOX-NAT", 1], ["CRE-GIA", 2]],            ["NATALE10"],              "Spedito",           "GLS"],
  ["#10474", "18/11 21:30", "G. Marino",        "IT", "B2C", [["AVV-CAL", 3]],                            [],                        "Spedito",           "BRT"],
  ["#10475", "19/11 08:10", "P. Neri",          "IT", "B2C", [["GIA-CAF", 2], ["TAV-GIA", 1]],            ["CAFFE15"],               "Spedito",           "BRT", "Lotto L26-1108"],
  ["#10476", "19/11 11:42", "R. Gentile",       "IT", "B2C", [["BOX-ASS", 1]],                            [],                        "In giacenza",       "BRT", "Destinatario assente (Milano)"],
  ["#10477", "19/11 18:20", "L. Colombo",       "IT", "B2C", [["GIA-250", 4]],                            ["BENVENUTO5"],            "Spedito",           "BRT"],
  ["#10478", "20/11 09:05", "A. Schmidt",       "DE", "B2C", [["GIA-250", 3]],                            [],                        "Spedito",           "GLS"],
  ["#10479", "20/11 12:10", "G. Russo",         "IT", "B2C", [["BOX-NAT", 1]],                            [],                        "Indirizzo errato",  "BRT", "Via Po 12 invece di 112"],
  ["#10480", "20/11 17:20", "Dolce Vita Torino","IT", "B2B", [["GIA-B2B", 20]],                           [],                        "In preparazione",   "",    "Scorta insufficiente (15/20 kg)", 670],
  ["#10481", "20/11 19:31", "P. Martin",        "FR", "B2C", [["BOX-NAT", 1], ["GIA-500", 1]],            [],                        "Rimborso richiesto","GLS", "Collo danneggiato"],
  ["#10482", "20/11 22:10", "S. Rinaldi",       "IT", "B2C", [["AVV-CAL", 1], ["TAV-GIA", 4]],            [],                        "Spedito",           "BRT", "Ritardo BRT +24/48h"],
  ["#10483", "21/11 02:10", "A. Villa",         "IT", "B2C", [["BOX-NAT", 3], ["TAV-GIA", 1]],            ["NATALE10", "BENVENUTO5"],"In preparazione",   "",    "Doppio sconto"],
  ["#10484", "21/11 07:15", "M. Dubois",        "FR", "B2C", [["AVV-CAL", 2], ["GIA-250", 1]],            [],                        "In attesa pagamento","",   "PayPal: nessuna conferma"],
  ["#10485", "21/11 07:42", "L. Ferrero",       "IT", "B2C", [["GIA-500", 1], ["BOX-NAT", 1]],            [],                        "Spedito",           "BRT", "Ritardo BRT +24/48h"],
  ["#10486", "21/11 07:44", "K. Weber",         "DE", "B2C", [["BOX-ASS", 1], ["GIA-500", 1]],            [],                        "Pagamento fallito", "",    "Carta rifiutata 2 volte"],
  ["#10487", "21/11 07:51", "E. Lombardi",      "IT", "B2C", [["GIA-FON", 1], ["GIA-CAF", 2]],            ["CAFFE15"],               "In preparazione",   "",    "Lotto L26-1108"],
  ["#10488", "21/11 07:58", "C. Moretti",       "IT", "B2C", [["BOX-NAT", 2]],                            ["NATALE10", "BENVENUTO5"],"In preparazione",   "",    "Doppio sconto"],
  ["#10489", "21/11 08:05", "F. Gallo",         "IT", "B2C", [["GIA-250", 2], ["TAV-GIA", 1]],            [],                        "In preparazione",   ""],
];

function orderTotal(items, promo, country) {
  let sub = 0, disc = 0;
  for (const [sku, q] of items) {
    const line = priceOf(sku) * q;
    sub += line;
    if (promo.includes("NATALE10") && sku === "BOX-NAT") disc += line * 0.1;
    if (promo.includes("CAFFE15") && sku === "GIA-CAF") disc += line * 0.15;
  }
  if (promo.includes("BENVENUTO5") && sub >= 30) disc += 5;
  const net = sub - disc;
  const free = country === "IT" ? net >= 49 : net >= 79;
  const ship = free ? 0 : country === "IT" ? 5.9 : 11.9;
  return Math.round((net + ship) * 100) / 100;
}

const ORDERS = ORDER_ROWS.map(([id, date, customer, country, kind, items, promo, status, carrier, flag, override]) => ({
  id, date, customer, country, kind, items, promo, status, carrier: carrier || "", flag: flag || "",
  total: override ?? orderTotal(items, promo, country),
})).reverse(); // newest first

// ---------- sources the Brain watches: emails, chat messages, tasks, docs ----------
// `access` = which roles may see this source (chat messages inherit their channel's access).
const mail = (id, from, to, date, access, title, body) => ({ id, type: "email", title, from, to, date, access, body });
const doc  = (id, from, date, access, title, body) => ({ id, type: "doc", title, from, date, access, body });
const task = (id, from, date, due, access, title, body) => ({ id, type: "task", title, from, date, due, access, body });
// Optional `extra` on any source:
//  - claim: { key, value, text } = fact the Brain extracted from the source (mock of the LLM extraction step).
//    If it contradicts an approved memory item with the same `fact.key`, it goes to quarantine instead of memory.
//  - live: true = source appears only when the "contrasto" demo event is fired.
const chat = (id, channel, from, date, body, extra = {}) => ({ id, type: "chat", channel, title: "#" + channel, from, date, access: channelAccess(channel), body, ...extra });

const SOURCES = [
  // ===== email: fornitori (laboratorio, packaging) =====
  mail("em-sara-ordine", "sara", "produzione@laboratorio-santanna.example", "19/11 14:20", ["magazzino", "shop"],
    "Riordino gianduiotti per il periodo natalizio",
    "Buongiorno,\nper il periodo natalizio vorremmo riordinare 400 Gianduiotti classici 250g e 300 Gianduiotti fondenti 70% 250g, con consegna richiesta entro il 25/11.\nGrazie,\nSara — Magazzino Bottega Sabauda"),
  mail("em-lab-conferma", "produzione@laboratorio-santanna.example", "sara", "20/11 16:02", ["magazzino", "shop"],
    "Re: Riordino gianduiotti per il periodo natalizio",
    "Confermiamo i 400 Gianduiotti classici 250g con consegna il 25/11. Per i 300 fondenti 70% c'è un ritardo sulla consegna del cacao dal porto di Genova: la consegna slitta al 28/11. Ricordiamo inoltre che la fattura n. 889 (3.450€) è scaduta il 15/11: finché non risulta saldata potremmo dover rivedere le priorità di produzione."),
  mail("em-fattura", "amministrazione@laboratorio-santanna.example", "marco", "20/11 09:30", ["shop"],
    "Fattura n. 889 — sollecito di pagamento",
    "Vi ricordiamo che la fattura n. 889 di 3.450€ per la fornitura di gianduiotti è scaduta il 15/11. Vi preghiamo di procedere al saldo."),
  mail("em-lotto", "qualita@laboratorio-santanna.example", "sara", "21/11 06:30", ["all"],
    "URGENTE — Lotto L26-1108 Gianduiotti al caffè: etichetta non conforme",
    "Durante un controllo interno abbiamo rilevato che il lotto L26-1108 (Gianduiotti al caffè 200g, 240 pezzi, consegnato il 12/11) è stato stampato con un'etichetta priva della dicitura allergene «contiene LATTE». Il prodotto non è pericoloso per chi non è allergico, ma l'etichetta non è conforme.\nVi chiediamo di: 1) sospendere subito la vendita del lotto; 2) isolare le giacenze; 3) avvisare i clienti che lo hanno già acquistato. Invieremo le etichette correttive entro lunedì 24/11."),
  mail("em-listino", "commerciale@laboratorio-santanna.example", "marco", "20/11 10:05", ["shop", "magazzino"],
    "Aggiornamento listino dal 1° gennaio",
    "Per il forte rincaro del cacao, dal 1° gennaio il listino sale del 3,5% su tutta la gamma. Gli ordini confermati entro il 31/12 mantengono i prezzi attuali."),
  mail("em-ormea", "commerciale@scatolificio-ormea.example", "sara", "17/11 10:40", ["magazzino", "shop"],
    "Preventivo scatole Box Natale",
    "Preventivo per scatole Box Natale 600g con carta oro: minimo 2.000 pezzi a 0,62€/pz, consegna in 10 giorni lavorativi dalla conferma. Cartoni esterni 40x30 disponibili a magazzino, 0,48€/pz."),

  // ===== email: corrieri e spedizioni =====
  mail("em-dhl", "commerciale@dhl-partner.example", "davide", "19/11 10:12", ["spedizioni", "clienti", "shop"],
    "Nuovo listino spedizioni estero",
    "Gentile Bottega Sabauda, confermiamo che dal 1° dicembre le spedizioni verso l'UE saranno gestite da DHL Express con tariffa fissa di 9,90€ a collo fino a 2kg. Il contratto con il precedente corriere (GLS) scade il 30/11. Le credenziali per il portale etichette vi saranno inviate entro il 25/11."),
  mail("em-brt-ritiri", "davide", "ritiri@brt.example", "20/11 11:00", ["spedizioni", "magazzino"],
    "Picco Black Friday: richiesta secondo ritiro",
    "Buongiorno,\nper la settimana del Black Friday prevediamo circa 90 colli lunedì 24/11 e 160 colli venerdì 27/11. Possiamo avere un secondo ritiro alle 11:00?\nGrazie, Davide — Spedizioni Bottega Sabauda"),
  mail("em-brt-ritiri-r", "ritiri@brt.example", "davide", "20/11 15:45", ["spedizioni", "magazzino"],
    "Re: Picco Black Friday: richiesta secondo ritiro",
    "Il secondo ritiro può essere attivato solo dal 26/11. Capacità massima: 140 colli per ritiro."),
  mail("em-brt-ritardo", "servizioclienti@brt.example", "davide", "21/11 07:05", ["spedizioni", "clienti"],
    "Avviso: ritardi di consegna Piemonte e Lombardia",
    "A causa di uno sciopero e dei volumi del Black Friday, le consegne in Piemonte e Lombardia subiranno ritardi di 24/48 ore dal 21/11 al 28/11."),
  mail("em-brt-giacenza", "giacenze@brt.example", "davide", "19/11 17:30", ["spedizioni", "clienti"],
    "Collo in giacenza — destinatario R. Gentile (ordine #10476)",
    "Il collo è giacente presso la filiale di Milano: destinatario assente al primo tentativo. Secondo tentativo entro 48 ore, poi ritorno al mittente."),
  mail("em-gls-reclamo", "reclami@gls-fr.example", "davide", "21/11 07:35", ["spedizioni", "clienti", "shop"],
    "Reclamo n. 77431 — destinatario P. Martin (ordine #10481)",
    "Abbiamo aperto il reclamo per danno da trasporto. Indennizzo massimo 100€ previa foto dell'imballo esterno e interno e del contenuto."),
  mail("em-conferma-ferrero", "noreply@bottegasabauda.example", "l.ferrero@mail.example", "21/11 07:42", ["clienti", "spedizioni"],
    "Il tuo ordine #10485 è in viaggio",
    "Ciao Luca, il tuo ordine #10485 è stato affidato a BRT. Consegna stimata: 24-25/11. Tracking: BRT 0884412099."),
  mail("em-conferma-russo", "noreply@bottegasabauda.example", "g.russo@mail.example", "20/11 22:15", ["clienti", "spedizioni"],
    "Il tuo ordine #10479 è in viaggio",
    "Ciao Giovanni, il tuo ordine #10479 è stato affidato a BRT. Consegna stimata: 22-23/11. Tracking: BRT 0884411763."),

  // ===== email: clienti e negozi =====
  mail("em-cli-martin", "p.martin@mail.example", "giulia", "20/11 19:31", ["clienti", "spedizioni", "shop"],
    "Commande #10481 — colis abîmé",
    "Bonjour, ma commande #10481 est arrivée avec la boîte écrasée et les chocolats cassés. Je joins des photos. Merci de me rembourser."),
  mail("em-cli-latte", "elena.fabbri@mail.example", "giulia", "21/11 08:02", ["clienti"],
    "Allergia al latte — gianduiotti al caffè",
    "Buongiorno, ho acquistato i gianduiotti al caffè (ordine #10465). Ho un'allergia al latte e sull'etichetta non trovo l'indicazione degli allergeni. I gianduiotti al caffè contengono latte? Grazie."),
  mail("em-cli-dubois", "marie.dubois@mail.example", "giulia", "21/11 07:30", ["clienti", "shop"],
    "Commande #10484 — pas de confirmation",
    "Bonjour, j'ai payé la commande #10484 avec PayPal mais je n'ai reçu aucune confirmation. Pouvez-vous vérifier ?"),
  mail("em-cli-weber", "k.weber@mail.example", "giulia", "21/11 07:50", ["clienti", "shop"],
    "Order #10486 — payment declined",
    "Hello, my card was declined twice for order #10486 although the card is fine. Could you send me another way to pay?"),
  mail("em-cli-russo", "g.russo@mail.example", "giulia", "20/11 12:30", ["clienti", "spedizioni"],
    "Indirizzo sbagliato ordine #10479",
    "Buongiorno, ho sbagliato l'indirizzo: ho scritto via Po 12 ma è via Po 112, Torino. Si può correggere? Grazie."),
  mail("em-cli-vittoria", "bar.vittoria@mail.example", "giulia", "19/11 15:10", ["clienti", "spedizioni"],
    "Ordine #10469 — scatole mancanti",
    "Il corriere ha lasciato il collo senza farci controllare: nel nostro ordine mancano 2 scatole di tavolette gianduja. Potete rispedirle? Siamo un bar di Torino e a Natale ne vendiamo tantissime."),
  mail("em-b2b-dolcevita", "info@dolcevitatorino.example", "marco", "19/11 17:10", ["shop", "magazzino"],
    "Richiesta fornitura gianduiotti sfusi per Natale",
    "Buonasera, vorremmo 20 kg di gianduiotti classici sfusi per le vetrine natalizie, consegna entro martedì 25/11 presso via Garibaldi 21, Torino. Fattura elettronica. Grazie, Dolce Vita Torino."),
  mail("em-newsletter", "campagne@mailer.example", "marco", "20/11 17:00", ["shop", "clienti"],
    "Campagna «Il Natale è dolce» programmata",
    "La campagna è programmata per il 21/11 alle 10:00 verso 8.400 iscritti. Contenuti: banner Box Natale (NATALE10) e banner Gianduiotti al caffè con codice CAFFE15 (-15%)."),

  // ===== documenti =====
  doc("dc-promo", "marco", "18/11", ["all"], "Calendario promozioni novembre–dicembre",
    "ATTIVE\n• NATALE10 — -10% solo sui Box Natale (BOX-NAT), fino al 30/11.\n• 2x1 Tavolette gianduja, fino al 23/11.\n• CAFFE15 — -15% sui Gianduiotti al caffè (smaltimento scorta), fino al 30/11.\n• BENVENUTO5 — -5€ sul primo ordine sopra 30€.\n• Spedizione gratuita in Italia sopra 49€ (estero sopra 79€).\nRegola: un solo codice sconto per ordine.\n\nPROGRAMMATE\n• Black Friday: -20% dal 27/11 al 30/11 su tutto il catalogo, esclusi Calendari dell'Avvento e ordini B2B. Da non comunicare ai clienti prima del 26/11.\n• Dal 1/12 spedizione UE a tariffa fissa DHL."),
  doc("dc-sconti", "marco", "02/10", ["all"], "Regole sconti e codici",
    "Ogni ordine può avere al massimo il 20% di sconto complessivo (codici promo e sconti manuali compresi). Sconti oltre il 20% non sono consentiti; per casi eccezionali serve l'approvazione dello Shop prima di applicarli."),
  doc("dc-resi", "sara", "02/09", ["all"], "Policy resi e rimborsi",
    "Prodotti danneggiati in transito: rimborso completo o rispedizione entro 14 giorni dalla consegna, con foto. I rimborsi fino a 100€ li approva il Servizio clienti; sopra 100€ serve l'approvazione dello Shop. Prodotti alimentari aperti: nessun reso per ripensamento."),
  doc("dc-spedizioni", "davide", "05/10", ["spedizioni", "magazzino", "clienti"], "Procedura spedizioni",
    "Cut-off ordini ore 14:00: ordini entro le 14:00 partono in giornata, dopo il giorno lavorativo successivo. Tempi di consegna: Italia 24-48h, UE 3-5 giorni lavorativi. Corrieri: BRT (Italia), GLS (estero, fino al 30/11), DHL Express (estero dal 1/12). Spedizioni a negozi: colli multipli con DDT, consegna su appuntamento; il collo va controllato alla consegna."),
  doc("dc-faq", "giulia", "10/10", ["all"], "FAQ clienti — allergeni e conservazione",
    "Tutti i gianduiotti contengono nocciole e latte; i fondenti 70% possono contenere tracce di latte. Possibili tracce di altra frutta a guscio e soia. Conservare in luogo fresco e asciutto, 12 mesi dal confezionamento."),
  doc("dc-b2b", "marco", "01/10", ["shop", "magazzino"], "Listino B2B negozi",
    "Sconto 35% sul listino al pubblico, minimo ordine 10 kg o 100€. Spedizione gratuita sopra 300€. Pagamento a 30 giorni, fattura elettronica. Le promozioni al pubblico (NATALE10, Black Friday) non si applicano al B2B."),
  doc("dc-margini", "marco", "20/11 16:40", ["shop"], "Report margini — novembre (bozza)",
    "Margine lordo novembre (al 20/11): 38,4%. Ricavi 41.200€, costo del venduto 25.380€. Margine più alto: tavolette (57%); più basso: Box Natale (31%, per il packaging). La spedizione gratuita sopra 49€ costa in media 4,80€ a ordine."),
  doc("dc-contratto-lab", "marco", "15/06", ["shop", "magazzino"], "Condizioni fornitore Laboratorio Sant'Anna",
    "Lead time 5 giorni lavorativi dalla conferma. Ordine minimo 200 pezzi per referenza. Pagamento a 30 giorni data fattura. Penale del 3% per ritardi di consegna oltre 3 giorni."),
  doc("dc-magazzino", "sara", "12/09", ["magazzino", "spedizioni"], "Procedura magazzino",
    "Gestione FIFO per lotto. Ogni arrivo viene registrato con numero di lotto; i lotti non conformi vanno spostati in quarantena (scaffale Q) e segnalati subito. Inventario ciclico settimanale a rotazione sugli scaffali A, B, C."),

  // ===== task =====
  task("tk-cumulo", "marco", "21/11", "22/11", ["shop", "clienti"], "Bloccare cumulo codici sconto nel checkout",
    "Task assegnato a Marco. Scadenza 22/11. Stato: in corso (80%)."),
  task("tk-inventario", "sara", "17/11", "24/11", ["magazzino", "spedizioni"], "Inventario ciclico scaffali A–C",
    "Task assegnato a Sara. Scadenza 24/11. Stato: 2 scaffali su 3 completati."),
  task("tk-dhl", "davide", "19/11", "28/11", ["spedizioni", "shop"], "Aggiornare etichette e tariffe per DHL Express (dal 1/12)",
    "Task assegnato a Davide. Scadenza 28/11. Stato: da iniziare, servono le credenziali DHL (attese entro il 25/11)."),
  task("tk-bf", "davide", "20/11", "26/11", ["magazzino", "spedizioni"], "Pianificare picking Black Friday (160 colli)",
    "Task assegnato a Davide con Sara. Scadenza 26/11. Stato: in pianificazione; dipende dall'arrivo dei cartoni esterni."),
  task("tk-faq", "giulia", "19/11", "28/11", ["clienti", "shop"], "Aggiornare FAQ allergeni sul sito",
    "Task assegnato a Giulia. Scadenza 28/11. Stato: non iniziato."),

  // ===== chat: #generale =====
  chat("ch-g1", "generale", "giulia", "18/11 09:02", "Buongiorno team! Chi ha le foto nuove dei Box Natale? Il sito ha ancora quelle dell'anno scorso 🎄"),
  chat("ch-g2", "generale", "marco", "18/11 09:10", "Le carico oggi pomeriggio, Sara me le ha passate ieri."),
  chat("ch-g3", "generale", "davide", "19/11 12:31", "Ricordo: venerdì 28 aperitivo di squadra dopo il Black Friday, se sopravviviamo 😅"),
  chat("ch-g4", "generale", "marco", "20/11 18:03", "ahah per il Black Friday facciamo 50% su tutto così finiamo i gianduiotti 😂",
    { claim: { key: "blackfriday.discount", value: "50%", text: "Per il Black Friday lo sconto è del 50% su tutto il catalogo." } }),
  chat("ch-g5", "generale", "sara", "20/11 18:04", "Marco dimmi che scherzi, il laboratorio ci ammazza 😅"),
  chat("ch-g6", "generale", "marco", "20/11 18:05", "Ovviamente scherzo!! Il Black Friday è -20% dal 27 al 30/11, ma non ditelo ai clienti prima del 26."),
  chat("ch-g7", "generale", "sara", "21/11 08:00", "Buongiorno a tutti ☕"),

  // ===== chat: #promo =====
  chat("ch-p1", "promo", "marco", "19/11 09:10", "Promo attive al momento: NATALE10 (-10% sui Box Natale fino al 30/11), 2x1 sulle tavolette di gianduja fino al 23/11, CAFFE15 (-15% sui gianduiotti al caffè, per smaltire la scorta), BENVENUTO5 (5€ sul primo ordine sopra 30€) e spedizione gratis sopra 49€ in Italia (79€ estero)."),
  chat("ch-p2", "promo", "giulia", "19/11 09:25", "Un cliente mi chiede se NATALE10 vale anche sul Calendario dell'Avvento. Ho detto di no, giusto?"),
  chat("ch-p3", "promo", "marco", "19/11 09:27", "Giusto, solo sui Box Natale. L'Avvento è già a prezzo lancio 29,90."),
  chat("ch-p4", "promo", "davide", "19/11 10:02", "Con spedizione gratis e Black Friday in arrivo ci aspettiamo il doppio dei colli. I corrieri sono già al limite."),
  chat("ch-p5", "promo", "sara", "20/11 11:40", "Per il 2x1 sulle tavolette ne abbiamo 300 a scaffale, la promo finisce domenica: poi le rimetto a prezzo pieno nel gestionale?"),
  chat("ch-p6", "promo", "marco", "20/11 11:44", "Sì, dal 24 le riporto io a 4,50€. Tu non devi fare nulla."),
  chat("ch-p7", "promo", "giulia", "20/11 15:12", "Altra domanda dai clienti: il codice benvenuto si può usare insieme al Black Friday?"),
  chat("ch-p8", "promo", "marco", "20/11 15:20", "Un solo codice per ordine, ma sto sistemando il checkout perché al momento non è bloccato."),
  chat("ch-p9", "promo", "marco", "20/11 17:30", "Black Friday confermato: -20% dal 27 al 30/11, esclusi Calendari dell'Avvento e ordini B2B. Banner pronto giovedì."),
  chat("ch-p10", "promo", "giulia", "21/11 07:55", "Mi stanno scrivendo in tanti per il Black Friday, posso già anticipare qualcosa?"),
  chat("ch-p11", "promo", "marco", "21/11 07:58", "Niente date né percentuali fino al 26, per favore."),

  // ===== chat: #magazzino =====
  chat("ch-m1", "magazzino", "sara", "18/11 15:20", "Inventario scaffale C fatto: i fondenti 70% oggi sono 95 pz. Ne vendiamo circa 19 al giorno."),
  chat("ch-m2", "magazzino", "davide", "18/11 15:24", "Occhio che dal 27 ne partiranno molti di più, i fondenti piacciono ai regali aziendali."),
  chat("ch-m3", "magazzino", "marco", "19/11 17:25", "Sara, ordine B2B da Dolce Vita Torino: 20 kg di classici sfusi entro martedì 25/11, prezzo listino B2B. Ce la fai?"),
  chat("ch-m4", "magazzino", "sara", "19/11 17:40", "Guardo lo sfuso: a gestionale vedo 15 kg. Dovrei chiedere un'integrazione al laboratorio."),
  chat("ch-m5", "magazzino", "sara", "20/11 16:15", "Il laboratorio ha spostato i fondenti al 28/11 per ritardi sul cacao. Con 38 pz a scaffale finiamo in 2 giorni. Marco, che facciamo sul sito?"),
  chat("ch-m6", "magazzino", "marco", "20/11 16:22", "Li segno «ultimi pezzi» e poi «disponibili dal 29/11». Se qualcuno li ordina in Black Friday non possiamo spedire prima."),
  chat("ch-m7", "magazzino", "davide", "20/11 16:30", "Meglio avvisare subito i clienti B2B che li hanno richiesti."),
  chat("ch-m8", "magazzino", "sara", "21/11 07:30", "Scatole Box Natale: i cartoni bastano per circa 90 box. Preventivo Ormea: minimo 2.000 pz a 0,62€, consegna in 10 giorni lavorativi. Ordiniamo oggi?"),
  chat("ch-m9", "magazzino", "marco", "21/11 07:36", "Sì, ma prima guardo il budget. Lo confermo lunedì."),
  chat("ch-m10", "magazzino", "davide", "21/11 07:48", "Mi servono anche 150 cartoni esterni 40x30 per le spedizioni del Black Friday, ne abbiamo solo 90."),
  chat("ch-m11", "magazzino", "sara", "21/11 07:52", "Li aggiungo all'ordine Ormea."),

  // ===== chat: #spedizioni =====
  chat("ch-s1", "spedizioni", "davide", "19/11 14:05", "Confermo il cut-off: ordini entro le 14:00 partono in giornata, dopo le 14:00 il giorno lavorativo successivo. Con il Black Friday la regola non cambia."),
  chat("ch-s2", "spedizioni", "giulia", "19/11 14:10", "Perfetto. I clienti chiedono sempre entro quando ordinare per ricevere prima di Natale: dico Italia entro il 18/12 e UE entro il 12/12?"),
  chat("ch-s3", "spedizioni", "davide", "19/11 14:20", "Sì, ma sono date indicative: con i ritardi dei corrieri a dicembre non posso garantire. Scrivi «consigliamo di ordinare entro»."),
  chat("ch-s4", "spedizioni", "davide", "20/11 11:00", "Ho scritto a BRT per il picco Black Friday: previsti 90 colli lunedì 24 e 160 venerdì 27."),
  chat("ch-s5", "spedizioni", "giulia", "20/11 12:40", "Davide, il cliente G. Russo (#10479) ha sbagliato l'indirizzo: via Po 12 invece di via Po 112. Il pacco è già partito."),
  chat("ch-s6", "spedizioni", "davide", "20/11 12:55", "Chiedo a BRT di intercettarlo: costa 7€ e non è garantito. Se rientra lo rispediamo noi a nostre spese."),
  chat("ch-s7", "spedizioni", "davide", "20/11 15:50", "BRT: secondo ritiro solo da giovedì 26/11 e massimo 140 colli a ritiro. Venerdì 27 con 160 colli rischiamo di non farcela."),
  chat("ch-s8", "spedizioni", "sara", "20/11 16:00", "Il 27 il magazzino riesce a preparare 160 colli solo se arrivano per tempo i cartoni. Dobbiamo anticipare il picking a giovedì sera."),
  chat("ch-s9", "spedizioni", "davide", "21/11 07:08", "BRT avvisa ritardi di 24/48h in Piemonte e Lombardia per sciopero e volumi: toccati #10482, #10485 e gli altri in partenza oggi."),
  chat("ch-s10", "spedizioni", "giulia", "21/11 07:14", "Ok, preparo una mail ai clienti coinvolti. Davide, mandami i numeri d'ordine."),
  chat("ch-s11", "spedizioni", "davide", "21/11 07:40", "Dal 1° dicembre l'estero passa a DHL Express a 9,90€ a collo (fino a 2kg), GLS scade il 30/11. Dobbiamo aggiornare tariffe sul sito e le etichette."),
  chat("ch-s12", "spedizioni", "sara", "21/11 07:44", "Per le etichette DHL servono rotoli 100x150 per la termica: ne ordino 4."),

  // ===== chat: #clienti =====
  chat("ch-c1", "clienti", "giulia", "19/11 09:00", "Ieri 23 ticket: 9 «dov'è il mio ordine?», 6 codici sconto che non funzionano, 4 domande sugli allergeni, 4 resi."),
  chat("ch-c2", "clienti", "marco", "19/11 09:12", "Sui codici è normale, ne vale uno per ordine. Poi sistemo il messaggio d'errore al checkout."),
  chat("ch-c3", "clienti", "giulia", "21/11 07:20", "Cliente P. Martin (ordine #10481) dice che il Box Natale e i gianduiotti sono arrivati con la scatola schiacciata e il cioccolato rotto, chiede rimborso. Ho le foto."),
  chat("ch-c4", "clienti", "davide", "21/11 07:26", "GLS ha aperto il reclamo 77431 e riconosce il danno, ma l'indennizzo è massimo 100€ e servono le foto dell'imballo."),
  chat("ch-c5", "clienti", "marco", "21/11 07:31", "Sotto i 100€ lo approvi tu Giulia, come da policy: rimborso completo."),
  chat("ch-c6", "clienti", "giulia", "21/11 08:03", "Mi ha scritto una cliente con allergia al latte: chiede se i gianduiotti al caffè contengono latte, perché sull'etichetta non lo trova. Io penso di sì ma non ne sono sicura."),
  chat("ch-c7", "clienti", "marco", "21/11 08:06", "Guarda la FAQ allergeni: tutti i gianduiotti contengono latte, nei fondenti solo tracce."),
  // LIVE: appears only when the "messaggio in contrasto" event is fired (see LIVE_CONFLICT)
  chat("ch-x1", "clienti", "giulia", "21/11 08:12", "Ho dato il 30% a un cliente fedele sull'ordine #10490 (2 box assortiti): il massimo sconto che possiamo fare è il 30%, giusto?",
    { live: true, claim: { key: "discount.max", value: "30%", text: "Lo sconto massimo applicabile a un ordine è il 30%." } }),

  // ===== chat: #shop =====
  chat("ch-sh1", "shop", "marco", "20/11 10:15", "Il laboratorio ci ha scritto: dal 1° gennaio il listino sale del 3,5% per il rincaro del cacao. Dobbiamo rivedere i prezzi di gennaio."),
  chat("ch-sh2", "shop", "marco", "21/11 06:59", "Il codice NATALE10 si cumula con BENVENUTO5: stanotte 14 ordini con doppio sconto, margine quasi azzerato sui Box Natale. Sto bloccando la cumulabilità nel checkout."),
  chat("ch-sh3", "shop", "giulia", "21/11 07:05", "Se qualcuno chiede rispondo che vale un solo codice per ordine. Ai 14 clienti lasciamo lo sconto già applicato?"),
  chat("ch-sh4", "shop", "marco", "21/11 07:10", "Sì, ormai è un nostro errore: li evadiamo normalmente, ma da oggi blocco."),
  chat("ch-sh5", "shop", "marco", "21/11 07:45", "Newsletter «Il Natale è dolce» parte alle 10:00 a 8.400 iscritti, con il banner CAFFE15 sui gianduiotti al caffè."),
];

// ---------- shared memory: facts the Brain extracted from sources; people curate them ----------
// status: approved | pending | rejected. Only approved items are used to answer.
const MEMORY = [
  { id: "M1", text: "Dal 1° dicembre le spedizioni verso l'UE passano a DHL Express, tariffa fissa 9,90€ a collo (≤2kg). Il contratto con GLS scade il 30/11.",
    sourceIds: ["em-dhl", "ch-s11"], access: ["spedizioni", "clienti", "shop"], status: "pending", proposedBy: "Brain",
    keywords: ["corriere", "spedizion", "dhl", "estero", "dicembre", "tariffa", "gls"] },
  // (M2 «Black Friday 50%» non esiste più: la battuta di ch-g4 viene intercettata dalla quarantena perché contraddice M3)
  { id: "M3", text: "Black Friday: -20% dal 27/11 al 30/11 su tutto il catalogo, esclusi Calendari dell'Avvento e ordini B2B. Riservato: non comunicarlo ai clienti prima del 26/11.",
    sourceIds: ["dc-promo", "ch-g6", "ch-p9"], access: ["all"], authority: ["shop"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    fact: { key: "blackfriday.discount", value: "20%" },
    keywords: ["black friday", "sconto", "promo", "bf"] },
  { id: "M15", text: "Sconto massimo applicabile a un ordine: 20% in totale (codici promo e sconti manuali compresi). Oltre il 20% non è consentito senza approvazione dello Shop.",
    sourceIds: ["dc-sconti"], access: ["all"], authority: ["shop"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    fact: { key: "discount.max", value: "20%" },
    keywords: ["massimo", "applicabil", "manuale", "manuali", "sconti"] },
  { id: "M4", text: "Margine lordo di novembre (al 20/11): 38,4% su 41.200€ di ricavi. Tavolette al 57%, Box Natale al 31%.",
    sourceIds: ["dc-margini"], access: ["shop"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    keywords: ["margine", "margini", "ricavi", "fatturato", "novembre"] },
  { id: "M5", text: "Prodotti danneggiati: rimborso completo entro 14 giorni dalla consegna, con foto. Fino a 100€ approva il Servizio clienti, sopra 100€ lo Shop.",
    sourceIds: ["dc-resi"], access: ["all"], status: "approved", proposedBy: "Brain", approvedBy: "Giulia Rossi",
    keywords: ["rimbors", "reso", "resi", "danneggiat", "rott", "schiacciat"] },
  { id: "M6", text: "Spedizioni: ordini entro le 14:00 partono in giornata. Consegna Italia 24-48h (BRT), UE 3-5 giorni lavorativi.",
    sourceIds: ["dc-spedizioni", "ch-s1"], access: ["all"], status: "approved", proposedBy: "Brain", approvedBy: "Davide Greco",
    keywords: ["cut-off", "cutoff", "14:00", "tempi", "consegna", "quanto ci mette", "arriva"] },
  { id: "M7", text: "Per ricevere i pacchi prima di Natale si consiglia di ordinare entro il 18/12 (Italia) e il 12/12 (UE). Date indicative, non garantite.",
    sourceIds: ["ch-s2", "ch-s3"], access: ["spedizioni", "magazzino", "clienti"], status: "pending", proposedBy: "Brain",
    keywords: ["natale", "ordinare", "entro quando", "scadenza", "prima di natale", "regalo"] },
  { id: "M8", text: "Promo attive: NATALE10 (-10% solo Box Natale, fino al 30/11), 2x1 tavolette (fino al 23/11), BENVENUTO5 (-5€ primo ordine >30€), spedizione gratis sopra 49€ (IT) / 79€ (estero). Si può usare un solo codice sconto per ordine.",
    sourceIds: ["dc-promo", "ch-p1"], access: ["all"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    keywords: ["cumul", "codice", "codici", "promo", "natale10", "benvenuto5", "2x1", "tavolette", "gratis"] },
  { id: "M9", text: "Il lotto L26-1108 dei Gianduiotti al caffè 200g ha un'etichetta priva dell'allergene «contiene latte»: vendita da sospendere, giacenze da isolare, clienti da avvisare.",
    sourceIds: ["em-lotto"], access: ["all"], status: "pending", proposedBy: "Brain",
    keywords: ["lotto", "l26-1108", "etichetta", "caffe", "richiamo"] },
  { id: "M10", text: "Tutti i gianduiotti contengono nocciole e latte; i fondenti 70% possono contenere tracce di latte. Possibili tracce di altra frutta a guscio e soia.",
    sourceIds: ["dc-faq"], access: ["all"], status: "approved", proposedBy: "Brain", approvedBy: "Giulia Rossi",
    keywords: ["latte", "allergen", "allergi", "nocciol", "contengono", "glutine", "soia"] },
  { id: "M11", text: "Laboratorio Sant'Anna: lead time 5 giorni lavorativi, ordine minimo 200 pz per referenza, pagamento a 30 giorni, penale 3% per ritardi oltre 3 giorni.",
    sourceIds: ["dc-contratto-lab"], access: ["shop", "magazzino"], status: "approved", proposedBy: "Brain", approvedBy: "Sara Conti",
    keywords: ["laboratorio", "fornitore", "lead time", "riordino", "minimo", "penale", "produzione"] },
  { id: "M12", text: "Le consegne dei 300 Gianduiotti fondenti 70% slittano al 28/11 (ritardo sul cacao); i 400 classici restano confermati per il 25/11.",
    sourceIds: ["em-lab-conferma", "ch-m5"], access: ["magazzino", "shop"], status: "pending", proposedBy: "Brain",
    keywords: ["fondenti", "ritardo", "cacao", "28/11", "classici"] },
  { id: "M13", text: "Listino B2B negozi: -35% sul listino pubblico, minimo 10 kg o 100€, spedizione gratuita sopra 300€, pagamento a 30 giorni. Le promo al pubblico non si applicano.",
    sourceIds: ["dc-b2b"], access: ["shop", "magazzino"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    keywords: ["b2b", "negozi", "negozio", "ingrosso", "listino"] },
  { id: "M14", text: "Magazzino: gestione FIFO per lotto; i lotti non conformi vanno in quarantena (scaffale Q) e segnalati subito.",
    sourceIds: ["dc-magazzino"], access: ["magazzino", "spedizioni"], status: "approved", proposedBy: "Brain", approvedBy: "Sara Conti",
    keywords: ["fifo", "quarantena", "lotto non conforme", "scaffale", "inventario"] },
];

// ---------- quarantine ("coda di scarto") ----------
// Sources are NOT trusted automatically. At load (and when a live source arrives) the Brain compares each source's `claim`
// with the approved memory item that has the same `fact.key`. A contradiction is not used: it goes to a review queue for
// the roles in that memory item's `authority`, who can "scarta e dimentica" (ban the source) or "accetta e aggiorna".
// Live demo event: a colleague wrongly writes that the max discount is 30% and applies it to an order.
const LIVE_CONFLICT = {
  label: "Messaggio in contrasto: «sconto massimo 30%»",
  sourceId: "ch-x1",
  order: { id: "#10490", date: "21/11 08:12", customer: "R. Barbero", country: "IT", kind: "B2C", items: [["BOX-ASS", 2]], promo: [],
    status: "In attesa approvazione sconto", carrier: "", flag: "Sconto manuale 30% (max consentito 20%)", total: 58.8 },
  correctTotal: 67.2, // 2 × 42,00 = 84,00 − 20% = 67,20 (spedizione gratuita)
  correctFlag: "Sconto riportato al 20%",
};

// ---------- actions the Brain proposes. Nothing runs until a person approves ----------
// effect: refund | payment | block | quarantine | notify | intercept | reorder
const ACTIONS = [
  { id: "A1", title: "Rimborso ordine #10481 (P. Martin) — 69,80€", owner: "clienti", effect: "refund", orderId: "#10481",
    why: "Il cliente segnala Box Natale schiacciato con foto, GLS ha riconosciuto il danno; la policy prevede rimborso completo sotto i 100€ (lo approva il Servizio clienti).",
    draft: "Chère Madame / Cher Monsieur Martin,\nnous sommes désolés pour ce désagrément. Nous avons procédé au remboursement complet de 69,80 € sur votre moyen de paiement d'origine.\n\nBottega Sabauda",
    sourceIds: ["ch-c3", "em-cli-martin", "dc-resi", "em-gls-reclamo"], status: "pending" },
  { id: "A2", title: "Pagare fattura n. 889 al Laboratorio Sant'Anna — 3.450€", owner: "shop", effect: "payment",
    why: "Fattura scaduta il 15/11, sollecito ricevuto il 20/11: il laboratorio ha accennato a rivedere le priorità di produzione, ed è il fornitore dei gianduiotti (prodotto più venduto).",
    draft: "Bonifico di 3.450€ a Laboratorio Dolciario Sant'Anna Srl, causale: Saldo fattura n. 889.",
    sourceIds: ["em-fattura", "em-lab-conferma"], status: "pending" },
  { id: "A3", title: "Sospendere vendita Gianduiotti al caffè e promo CAFFE15", owner: "shop", effect: "block", sku: "GIA-CAF",
    why: "Il lotto L26-1108 ha un'etichetta senza l'allergene latte. La promo CAFFE15 è attiva e la newsletter delle 10:00 la promuove a 8.400 iscritti.",
    draft: "1) Nascondere GIA-CAF dallo shop.\n2) Disattivare il codice CAFFE15.\n3) Rimuovere il banner dalla newsletter «Il Natale è dolce» (parte alle 10:00).",
    sourceIds: ["em-lotto", "em-newsletter", "dc-promo"], status: "pending" },
  { id: "A4", title: "Quarantena lotto L26-1108 — 202 pz a scaffale", owner: "magazzino", effect: "quarantine",
    why: "Richiesta del laboratorio: isolare le giacenze del lotto. La procedura prevede lo scaffale Q per i lotti non conformi.",
    draft: "Spostare tutti i Gianduiotti al caffè 200g del lotto L26-1108 (202 pz) sullo scaffale Q e bloccarli a gestionale. Non evadere ordini che li contengono (#10487).",
    sourceIds: ["em-lotto", "dc-magazzino"], status: "pending" },
  { id: "A5", title: "Avviso ai clienti che hanno acquistato il lotto L26-1108", owner: "clienti", effect: "notify",
    why: "Il lotto è stato venduto in 17 ordini (38 pz), tra cui #10465 e #10475. Una cliente allergica al latte ha già scritto.",
    draft: "Gentile cliente,\nil laboratorio ci ha segnalato che l'etichetta del lotto L26-1108 dei Gianduiotti al caffè 200g non riporta la dicitura «contiene latte». Il prodotto contiene latte: se sei allergico o intollerante, non consumarlo. Ti rimborsiamo l'acquisto, basta rispondere a questa mail.\n\nBottega Sabauda",
    sourceIds: ["em-lotto", "em-cli-latte", "dc-faq"], status: "pending" },
  { id: "A6", title: "Avviso ritardo BRT ai clienti Piemonte/Lombardia", owner: "clienti", effect: "notify",
    why: "BRT segnala +24/48h dal 21 al 28/11. Toccati almeno #10482 e #10485.",
    draft: "Gentile cliente,\ncausa sciopero e volumi del periodo natalizio il corriere ha comunicato un ritardo di 24-48 ore sul tuo ordine. Puoi seguire la spedizione dal link di tracking. Grazie per la pazienza!\n\nBottega Sabauda",
    sourceIds: ["em-brt-ritardo", "ch-s9"], status: "pending" },
  { id: "A7", title: "Intercettare collo #10479 (G. Russo) — indirizzo errato", owner: "spedizioni", effect: "intercept", orderId: "#10479",
    why: "Il cliente ha scritto via Po 12 invece di 112. BRT può intercettare il collo a 7€, senza garanzia; in alternativa rientra in sede e si rispedisce.",
    draft: "A BRT — richiesta di intercettazione collo ordine #10479, destinatario G. Russo. Correggere indirizzo in: via Po 112, Torino.",
    sourceIds: ["em-cli-russo", "ch-s5", "ch-s6"], status: "pending" },
];

// ---------- proactive brief items per role (the Brain speaks first) ----------
const BRIEF_ITEMS = {
  magazzino: [
    { text: "<b>Lotto L26-1108 (Gianduiotti al caffè) da isolare</b>: il laboratorio segnala un'etichetta senza l'allergene latte. A scaffale ci sono circa 202 pz: la quarantena è in <i>Azioni</i>.", sources: ["em-lotto", "STORE-GIA-CAF"] },
    { text: "<b>Fondenti 70% a 38 pz</b>, sotto soglia (60): il laboratorio ha spostato la consegna dei 300 pz al 28/11. Al ritmo di ~19/giorno finiscono tra 2 giorni.", sources: ["em-lab-conferma", "STORE-GIA-FON"] },
    { text: "<b>Ordine B2B Dolce Vita Torino</b>: 20 kg di classici sfusi entro il 25/11, ma a gestionale risultano 15 kg.", sources: ["em-b2b-dolcevita", "STORE-GIA-B2B"] },
  ],
  clienti: [
    { text: "<b>Rimborso ordine #10481</b> (P. Martin, 69,80€): Box Natale arrivato schiacciato, GLS ha riconosciuto il danno. Sotto i 100€: la bozza è in <i>Azioni</i>.", sources: ["em-cli-martin", "dc-resi", "em-gls-reclamo"] },
    { text: "<b>Lotto L26-1108 non conforme</b>: la cliente dell'ordine #10465 con allergia al latte ti ha scritto. I gianduiotti al caffè <b>contengono latte</b> (FAQ allergeni): non confermarle che è sicuro senza l'avviso ufficiale. Ho preparato l'avviso per tutti gli acquirenti del lotto.", sources: ["em-lotto", "em-cli-latte", "dc-faq"] },
    { text: "<b>Ritardi BRT</b> di 24/48h in Piemonte e Lombardia fino al 28/11 (toccati #10482 e #10485): bozza di avviso in <i>Azioni</i>.", sources: ["em-brt-ritardo"] },
    { text: "Due clienti con pagamento in sospeso ti hanno scritto: <b>#10484</b> (Dubois, PayPal) e <b>#10486</b> (Weber, carta rifiutata).", sources: ["em-cli-dubois", "em-cli-weber"] },
  ],
  shop: [
    { text: "<b>Promo CAFFE15 attiva su un prodotto bloccato</b> (lotto L26-1108) e la newsletter delle 10:00 la promuove a 8.400 iscritti: la sospensione è in <i>Azioni</i>.", sources: ["em-newsletter", "em-lotto", "dc-promo"] },
    { text: "<b>Fattura n. 889 scaduta</b> (3.450€) al Laboratorio Sant'Anna: è il fornitore dei gianduiotti e ha accennato a rivedere le priorità di produzione. Pagamento in <i>Azioni</i>.", sources: ["em-fattura", "em-lab-conferma"] },
    { text: "<b>Cumulo codici sconto</b>: NATALE10 + BENVENUTO5 su 14 ordini stanotte (es. #10483, #10488). Il task di blocco nel checkout è all'80%.", sources: ["ch-sh2", "tk-cumulo"] },
    { text: "Margine lordo di novembre al <b>38,4%</b>; i Box Natale sono i meno redditizi (31%) e il listino del laboratorio sale del 3,5% da gennaio.", sources: ["dc-margini", "em-listino"] },
  ],
  spedizioni: [
    { text: "<b>Ritardi BRT 24/48h</b> in Piemonte e Lombardia fino al 28/11 (sciopero + volumi Black Friday). Ho passato al Servizio clienti la bozza di avviso.", sources: ["em-brt-ritardo", "ch-s9"] },
    { text: "<b>Black Friday</b>: previsti 160 colli venerdì 27/11, ma BRT concede max 140 colli a ritiro e il secondo ritiro solo da giovedì 26/11.", sources: ["em-brt-ritiri-r", "ch-s7"] },
    { text: "<b>Ordine #10479 con indirizzo errato</b> (via Po 12 → 112): proposta di intercettazione BRT (7€) in <i>Azioni</i>. Inoltre il collo #10476 è in giacenza a Milano.", sources: ["em-cli-russo", "em-brt-giacenza"] },
    { text: "Dal 1/12 l'estero passa a <b>DHL Express</b> (9,90€ a collo ≤2kg); GLS scade il 30/11. Il task di aggiornamento etichette non è ancora iniziato.", sources: ["em-dhl", "tk-dhl"] },
  ],
};

// Triggerable store event (for the "it speaks first" demo)
const SIMULATED_EVENT = {
  label: "Picco di ordini: Gianduiotti classici sotto scorta",
  apply(state) {
    const p = state.products.find((x) => x.sku === "GIA-250");
    p.stock = 24;
    p.sold7d += 118;
  },
  alert: {
    target: "magazzino",
    title: "⚠️ Gianduiotti classici 250g sotto scorta (24 pz)",
    text: "Dopo il post di un'influencer ne sono stati venduti 118 in 60 minuti: al ritmo attuale finiscono entro 2 ore, a 6 giorni dal Black Friday. Il laboratorio ha un lead time di 5 giorni lavorativi: un riordino oggi arriva il 28/11, a Black Friday già iniziato (i 400 pz già ordinati arrivano il 25/11). Ti ho preparato una bozza di riordino da approvare.",
    sourceIds: ["STORE-GIA-250", "dc-contratto-lab"],
  },
  action: {
    id: "A8", title: "Riordino urgente 600 pz Gianduiotti classici 250g dal laboratorio", owner: "magazzino", effect: "reorder", sku: "GIA-250", qty: 600,
    why: "Scorta a 24 pz, vendite in accelerazione (118 pz/ora). Attenzione: c'è una fattura scaduta con questo fornitore (la vede lo Shop) e i 400 pz già ordinati arrivano il 25/11.",
    draft: "Buongiorno,\nvorremmo ordinare altri 600 Gianduiotti classici 250g, se possibile con consegna anticipata entro il 26/11 (prima del Black Friday). In allegato la conferma d'ordine.\n\nGrazie, Sara — Magazzino Bottega Sabauda",
    sourceIds: ["STORE-GIA-250", "em-lab-conferma", "dc-contratto-lab"], status: "pending",
  },
};
