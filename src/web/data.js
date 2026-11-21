// Mock data for "Bottega Sabauda" — a fictional Turin e-commerce store.
// Everything the Company Brain "watches" lives here. Step 2 will replace the
// answer engine with Gemini, but this data stays as the demo dataset.

const USERS = {
  giulia: { id: "giulia", name: "Giulia Rossi", role: "finance", roleLabel: "Finance", avatar: "GR", color: "#e8a33d" },
  marco:  { id: "marco",  name: "Marco Bianchi", role: "tech",    roleLabel: "Tech",    avatar: "MB", color: "#3d8be8" },
  sara:   { id: "sara",   name: "Sara Conti",    role: "ops",     roleLabel: "Operations", avatar: "SC", color: "#3dbb7a" },
};

const ROLE_LABELS = { finance: "Finance", tech: "Tech", ops: "Operations", all: "Tutti" };

// Store data (what the online shop admin shows)
const PRODUCTS = [
  { sku: "GIA-250", name: "Gianduiotti classici 250g", price: 14.9, stock: 42, threshold: 30, sold7d: 180 },
  { sku: "VER-075", name: "Vermouth di Torino 75cl",   price: 24.0, stock: 65, threshold: 20, sold7d: 38 },
  { sku: "GRI-500", name: "Grissini stirati 500g",     price: 6.5,  stock: 210, threshold: 50, sold7d: 95 },
  { sku: "NOC-IGP", name: "Nocciole Piemonte IGP 1kg", price: 19.5, stock: 18, threshold: 25, sold7d: 22 },
  { sku: "BIC-KIT", name: "Kit Bicerin per 4",         price: 29.0, stock: 77, threshold: 15, sold7d: 31 },
];

const ORDERS = [
  { id: "#10482", customer: "L. Ferrero",   country: "IT", total: 59.6, status: "Spedito",     date: "21/11 07:42" },
  { id: "#10481", customer: "M. Dubois",    country: "FR", total: 88.0, status: "In attesa pagamento", date: "21/11 07:15" },
  { id: "#10480", customer: "A. Schmidt",   country: "DE", total: 43.5, status: "Pagamento fallito",   date: "21/11 06:58" },
  { id: "#10479", customer: "G. Russo",     country: "IT", total: 29.0, status: "Spedito",     date: "20/11 22:10" },
  { id: "#10478", customer: "P. Martin",    country: "FR", total: 74.4, status: "Rimborso richiesto",  date: "20/11 19:31" },
  { id: "#10477", customer: "S. Bruno",     country: "IT", total: 19.5, status: "Consegnato",  date: "20/11 17:05" },
];

// Raw sources the Brain watches: emails, chat messages, tasks, docs.
// `access` = which roles may see this source.
const SOURCES = [
  { id: "S1", type: "email", title: "Nuovo listino spedizioni estero", from: "commerciale@dhl-partner.example", to: "sara", date: "19/11 10:12",
    access: ["ops", "finance"],
    body: "Gentile Bottega Sabauda, confermiamo che dal 1° dicembre le spedizioni verso l'UE saranno gestite da DHL Express con tariffa fissa di 9,90€ a collo fino a 2kg. Il contratto con il precedente corriere scade il 30/11." },
  { id: "S2", type: "chat", channel: "generale", title: "#generale", from: "marco", date: "20/11 18:03",
    access: ["all"],
    body: "ahah per il Black Friday facciamo 50% su tutto così finiamo i gianduiotti 😂" },
  { id: "S3", type: "doc", title: "Report margini — Novembre (bozza)", from: "giulia", date: "20/11 16:40",
    access: ["finance"],
    body: "Margine lordo novembre (al 20/11): 38,4%. Ricavi 41.200€, costo del venduto 25.380€. Il vermouth ha il margine più alto (52%)." },
  { id: "S4", type: "chat", channel: "tech", title: "#tech", from: "marco", date: "21/11 06:59",
    access: ["tech"],
    body: "Vedo errori 502 dal gateway di pagamento Stripe-mock sugli ordini esteri da stanotte, sto indagando." },
  { id: "S5", type: "task", title: "Migrare checkout a nuova versione API pagamenti", from: "marco", date: "15/11", due: "25/11",
    access: ["tech"],
    body: "Task assegnato a Marco. Scadenza 25/11. Stato: in corso (60%)." },
  { id: "S6", type: "email", title: "Fattura n. 2024/889 — sollecito", from: "amministrazione@cioccolateria-fornitore.example", to: "giulia", date: "20/11 09:30",
    access: ["finance"],
    body: "Vi ricordiamo che la fattura n. 889 di 3.450€ per la fornitura di gianduiotti è scaduta il 15/11. Vi preghiamo di procedere al saldo." },
  { id: "S7", type: "chat", channel: "ordini", title: "#ordini", from: "sara", date: "21/11 07:20",
    access: ["all"],
    body: "Cliente P. Martin (ordine #10478) dice che i grissini sono arrivati rotti, chiede rimborso. Ho le foto." },
  { id: "S8", type: "doc", title: "Policy resi e rimborsi", from: "sara", date: "02/09",
    access: ["all"],
    body: "Rimborso completo entro 14 giorni dalla consegna per prodotti danneggiati, con foto. Rimborsi sopra 100€ richiedono approvazione Finance." },
  { id: "S9", type: "doc", title: "Accessi server e deploy", from: "marco", date: "10/10",
    access: ["tech"],
    body: "Il sito gira su Cloud Run (regione europe-west4). Il deploy si fa dal branch main con GitHub Actions. Le credenziali sono nel Secret Manager, non nel repo." },
];

// Shared memory: facts the Brain extracted from sources. People curate them.
// status: approved | pending | rejected. Only approved items are used to answer.
const MEMORY = [
  { id: "M1", text: "Dal 1° dicembre le spedizioni UE passano a DHL Express, tariffa fissa 9,90€ a collo (≤2kg).",
    sourceIds: ["S1"], access: ["all"], status: "pending", proposedBy: "Brain",
    keywords: ["corriere", "spedizion", "dhl", "estero", "dicembre", "tariffa"] },
  { id: "M2", text: "Per il Black Friday lo sconto è del 50% su tutto il catalogo.",
    sourceIds: ["S2"], access: ["all"], status: "pending", proposedBy: "Brain",
    keywords: ["black friday", "sconto", "promo"] },
  { id: "M3", text: "Margine lordo di novembre (al 20/11): 38,4% su 41.200€ di ricavi.",
    sourceIds: ["S3"], access: ["finance"], status: "approved", proposedBy: "Brain", approvedBy: "Giulia Rossi",
    keywords: ["margine", "ricavi", "fatturato", "novembre"] },
  { id: "M4", text: "Rimborso completo entro 14 giorni per prodotti danneggiati, con foto. Sopra 100€ serve l'approvazione Finance.",
    sourceIds: ["S8"], access: ["all"], status: "approved", proposedBy: "Brain", approvedBy: "Sara Conti",
    keywords: ["rimbors", "reso", "resi", "danneggiat", "rott"] },
  { id: "M5", text: "Il sito gira su Cloud Run (europe-west4); deploy dal branch main via GitHub Actions; credenziali in Secret Manager.",
    sourceIds: ["S9"], access: ["tech"], status: "approved", proposedBy: "Brain", approvedBy: "Marco Bianchi",
    keywords: ["deploy", "server", "cloud run", "credenzial", "regione", "hosting"] },
];

// Actions the Brain proposes. Nothing runs until a person approves.
const ACTIONS = [
  { id: "A1", title: "Rimborso ordine #10478 (P. Martin) — 74,40€", owner: "ops",
    why: "Il cliente segnala grissini rotti con foto; la policy prevede rimborso completo sotto i 100€.",
    draft: "Gentile Sig. Martin,\nci scusiamo per l'inconveniente. Abbiamo disposto il rimborso completo di 74,40€ sul metodo di pagamento originale.\n\nBottega Sabauda",
    effect: "refund", sourceIds: ["S7", "S8"], status: "pending" },
  { id: "A2", title: "Pagare fattura n. 889 al fornitore cioccolato — 3.450€", owner: "finance",
    why: "Fattura scaduta il 15/11, sollecito ricevuto il 20/11. Il fornitore è critico per il prodotto più venduto.",
    draft: "Bonifico di 3.450€ a Cioccolateria Fornitore Srl, causale: Saldo fattura n. 2024/889.",
    effect: "payment", sourceIds: ["S6"], status: "pending" },
];

// Triggerable store event (for the "it speaks first" demo)
const SIMULATED_EVENT = {
  label: "Picco di ordini: Gianduiotti sotto scorta",
  apply(state) {
    const p = state.products.find((x) => x.sku === "GIA-250");
    p.stock = 12;
    p.sold7d += 30;
  },
  alert: {
    target: "ops",
    title: "⚠️ Gianduiotti 250g sotto scorta (12 pz)",
    text: "Negli ultimi 60 minuti sono stati venduti 30 pezzi. Al ritmo attuale finiscono entro domani mattina, prima del weekend del Black Friday. Ti ho preparato una bozza di riordino da approvare.",
    sourceIds: ["STORE-GIA-250"],
  },
  action: {
    id: "A3", title: "Riordino 200 pz Gianduiotti 250g dal fornitore", owner: "ops",
    why: "Scorta a 12 pz, vendite in accelerazione (30 pz/ora). Attenzione: c'è una fattura scaduta con questo fornitore (lo vede Finance).",
    draft: "Buongiorno,\nvorremmo ordinare 200 confezioni di Gianduiotti classici 250g con consegna entro martedì 25/11.\n\nGrazie, Sara — Bottega Sabauda",
    effect: "reorder", sourceIds: ["STORE-GIA-250"], status: "pending",
  },
};
