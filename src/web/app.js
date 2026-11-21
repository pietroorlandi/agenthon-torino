// Company Brain — demo UI (step 1: fully client-side, mock answer engine).
// The function `askBrain()` is the single point to swap with a Gemini backend later.
// Dataset (users, channels, products, orders, sources, memory, actions) lives in data.js.

const TABS = [
  { id: "guide",   label: "🎯 Guida demo" },
  { id: "chat",    label: "💬 Chat" },
  { id: "email",   label: "📧 Email del mattino" },
  { id: "store",   label: "🛒 Store" },
  { id: "memory",  label: "🧠 Memoria" },
  { id: "actions", label: "✅ Azioni" },
  { id: "sources", label: "📁 Fonti" },
];

let state;

function initialState() {
  const s = {
    userId: "sara",
    tab: "guide",
    channel: "brain",
    products: structuredClone(PRODUCTS),
    orders: structuredClone(ORDERS),
    memory: structuredClone(MEMORY),
    actions: structuredClone(ACTIONS),
    quarantine: [],   // claims that contradict approved memory, waiting for an authorised person
    banned: {},       // sourceId -> true: banned sources are forgotten
    gaps: [],         // knowledge gaps: questions nobody documented, assigned to the competent role
    extraSources: [], // notes written by people when they fill a gap
    dm: {},
    unread: {},
    log: [],
    eventFired: false,
    conflictFired: false,
  };
  detectConflicts(s);
  for (const id of Object.keys(USERS)) {
    s.dm[id] = [buildBrief(USERS[id], s)];
    s.unread[id] = 1;
  }
  return s;
}

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const now = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const me = () => USERS[state.userId];
const canSee = (access, role) => access.includes("all") || access.includes(role);
const userWithRole = (role) => Object.values(USERS).find((u) => u.role === role);
const who = (x) => USERS[x]?.name || x;
const roleList = (access) => access.map((r) => ROLE_LABELS[r]).join(", ");
// "21/11 07:20" -> sortable number
const dateKey = (d) => {
  const m = /(\d\d)\/(\d\d)(?: (\d\d):(\d\d))?/.exec(d);
  return m ? +m[2] * 1e6 + +m[1] * 1e4 + (+m[3] || 0) * 100 + (+m[4] || 0) : 0;
};

// Sources visible right now (live ones appear only after their demo event).
const liveSources = () => [...SOURCES.filter((s) => !s.live || state.conflictFired), ...state.extraSources];

// ---------- quarantine: do not trust sources blindly ----------
// For every source claim, compare it with the approved memory item having the same fact key.
// A different value is NOT used and NOT proposed as memory: it is queued for the memory's authority roles.
function detectConflicts(s) {
  const created = [];
  for (const src of SOURCES.filter((x) => x.claim && (!x.live || s.conflictFired))) {
    const mem = s.memory.find((m) => m.status === "approved" && m.fact?.key === src.claim.key);
    if (!mem || mem.fact.value === src.claim.value) continue;
    if (s.quarantine.some((q) => q.sourceId === src.id)) continue;
    const live = src.id === LIVE_CONFLICT.sourceId;
    const q = { id: `Q${s.quarantine.length + 1}`, sourceId: src.id, memoryId: mem.id, claim: src.claim, authority: mem.authority || mem.access,
      status: "pending", orderId: live ? LIVE_CONFLICT.order.id : null };
    s.quarantine.push(q);
    created.push(q);
  }
  return created;
}
const pendingQuarantine = (role) => state.quarantine.filter((q) => q.status === "pending" && q.authority.includes(role));

function getSource(id) {
  if (id.startsWith("STORE-")) {
    const sku = id.slice(6);
    const p = state.products.find((x) => x.sku === sku);
    return { id, type: "store", title: `Store admin — scorte ${sku}`, from: "sistema", date: "live", access: ["all"],
      body: `${p.name}: ${p.stock} pz in magazzino (soglia ${p.threshold}), ${p.sold7d} venduti negli ultimi 7 giorni.${p.blocked ? " Vendita sospesa." : ""}` };
  }
  return SOURCES.find((s) => s.id === id) || state.extraSources.find((s) => s.id === id);
}

const TYPE_ICON = { email: "📧", chat: "💬", doc: "📄", task: "☑️", store: "🛒", note: "📝" };

// ---------- knowledge gaps ----------
// Which role could know the answer to a question? (TOPIC_OWNERS in data.js; null = out of company scope)
function routeQuestion(q) {
  const scored = TOPIC_OWNERS.map((t) => ({ t, score: t.keywords.filter((k) => q.includes(norm(k))).length })).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score)[0]?.t || null;
}

const STOPWORDS = new Set(["quale", "quali", "quando", "quanto", "quanta", "quanti", "quante", "perche", "della", "delle", "degli", "dello", "nella", "nelle", "negli", "alla", "alle", "agli", "dalla", "dalle", "abbiamo", "nostro", "nostra", "nostri", "nostre", "questo", "questa", "sono", "possiamo", "posso", "dobbiamo", "funziona", "funzionano"]);
// Index keywords for a fact written by a person: significant words of the question, cut to a 6-char stem.
const deriveKeywords = (text) => [...new Set(norm(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOPWORDS.has(w)).map((w) => w.slice(0, 6)))];

function openGap(question, asker, topic) {
  const key = norm(question).replace(/[^a-z0-9 ]/g, "").trim();
  const existing = state.gaps.find((g) => g.key === key && g.status === "open");
  if (existing) return { gap: existing, isNew: false };
  const gap = { id: `G${state.gaps.length + 1}`, key, question, askedBy: asker.id, owner: topic.role, topicLabel: topic.label, status: "open", time: now() };
  state.gaps.push(gap);
  const owner = userWithRole(topic.role);
  if (owner && owner.id !== asker.id) {
    pushBrain(owner.id, { from: "brain", kind: "alert", gapId: gap.id,
      text: `<b>📝 Buco di conoscenza da colmare</b><br>${esc(asker.name)} (${asker.roleLabel}) ha chiesto: «${esc(question)}». Non è nella memoria e sembra di tua competenza (${esc(topic.label)}). Puoi scrivere la risposta e la domanda a cui risponde in <i>Memoria → Da documentare</i>?` });
  }
  return { gap, isNew: true };
}
const openGaps = (role) => state.gaps.filter((g) => g.status === "open" && g.owner === role);

function citeChips(ids) {
  if (!ids?.length) return "";
  return `<div class="cites"><span class="muted">Fonti:</span> ${ids.map((id) => {
    const s = getSource(id);
    return `<button class="chip" data-source="${id}">${TYPE_ICON[s.type]} ${esc(s.title)}</button>`;
  }).join("")}</div>`;
}

// ---------- proactive brief (the Brain speaks first) ----------
// Items per role live in data.js (BRIEF_ITEMS); here we only add the dynamic part.
function buildBrief(user, s) {
  const items = [...(BRIEF_ITEMS[user.role] || [])];
  const pendingMem = s.memory.filter((m) => m.status === "pending" && canSee(m.access, user.role)).length;
  const quar = s.quarantine.filter((q) => q.status === "pending" && q.authority.includes(user.role));
  quar.forEach((q) => items.unshift({ text: `🛡️ <b>Informazione in quarantena</b>: «${esc(q.claim.text)}» contraddice la memoria approvata. Non la uso finché non decidi in <i>Memoria</i>.`, sources: [q.sourceId] }));
  const gaps = (s.gaps || []).filter((g) => g.status === "open" && g.owner === user.role);
  if (gaps.length) items.push({ text: `📝 Hai <b>${gaps.length} domande da documentare</b> che nessuno aveva mai scritto (es. «${esc(gaps[0].question)}»).`, sources: [] });
  if (pendingMem) items.push({ text: `Hai <b>${pendingMem} elementi di memoria</b> da revisionare.`, sources: [] });

  return { from: "brain", kind: "brief", time: "08:00", items,
    text: `Buongiorno ${user.name.split(" ")[0]}, ecco cosa richiede la tua attenzione oggi:` };
}

// ---------- answer engine (mock; step 2 -> Gemini) ----------
function scoreItem(item, q) {
  return item.keywords.reduce((n, k) => n + (q.includes(norm(k)) ? 1 : 0), 0);
}

function askBrain(question, user) {
  const q = norm(question);
  // minScore: facts written by people (gap answers) need ≥2 matching words, to avoid matching on one generic word
  const best = (list) => list.map((m) => ({ m, score: scoreItem(m, q) })).filter((x) => x.score >= (x.m.minScore || 1)).sort((a, b) => b.score - a.score)[0]?.m;

  const approved = best(state.memory.filter((m) => m.status === "approved"));
  if (approved) {
    if (!canSee(approved.access, user.role)) {
      const owners = roleList(approved.access);
      const contact = userWithRole(approved.access[0]);
      return { from: "brain", kind: "denied",
        text: `🔒 L'informazione esiste, ma è riservata al team <b>${owners}</b>: non posso condividerla con il ruolo ${user.roleLabel}.${contact ? ` Puoi chiedere a ${contact.name}.` : ""}` };
    }
    return { from: "brain", kind: "answer", text: esc(approved.text), sources: approved.sourceIds, memoryId: approved.id };
  }

  const pending = best(state.memory.filter((m) => m.status === "pending"));
  let text = "🤷 <b>Non lo so.</b> Non c'è nulla nella memoria approvata che risponda a questa domanda, e non voglio inventare.";
  if (pending && canSee(pending.access, user.role)) {
    text += `<br><span class="muted">C'è un elemento <b>in attesa di revisione</b> che potrebbe essere rilevante: lo userò solo dopo che qualcuno lo avrà approvato in Memoria.</span>`;
    return { from: "brain", kind: "unknown", text };
  }

  // Knowledge gap: nobody ever documented it. If it's a company topic, ask the competent person to write it down.
  const topic = routeQuestion(q);
  if (!topic) {
    text += `<br><span class="muted">È fuori dal perimetro di Bottega Sabauda: non c'è nessuno a cui chiederlo internamente.</span>`;
    return { from: "brain", kind: "unknown", text };
  }
  const { gap, isNew } = openGap(question, user, topic);
  const owner = userWithRole(topic.role);
  const ownerTxt = owner.id === user.id ? "Sembra di <b>tua</b> competenza" : `Sembra di competenza <b>${ROLE_LABELS[topic.role]}</b> (${esc(topic.label)})`;
  text += `<br>📝 ${ownerTxt}: è un'informazione aziendale che qualcuno conosce ma che non è mai stata scritta. `
    + (owner.id === user.id ? `Puoi documentarla tu in <i>Memoria → Da documentare</i>.`
      : isNew ? `Ho chiesto a <b>${owner.name}</b> di documentarla: quando risponde te lo scrivo qui.`
      : `C'è già una richiesta aperta a <b>${owner.name}</b> su questa domanda.`);
  return { from: "brain", kind: "gap", text, gapId: gap.id };
}

// ---------- rendering ----------
function render() {
  $("#tabs").innerHTML = TABS.map((t) => {
    const badge = t.id === "chat" && state.unread[state.userId] ? `<span class="badge">${state.unread[state.userId]}</span>` : "";
    const pend = t.id === "actions" ? state.actions.filter((a) => a.status === "pending" && a.owner === me().role).length : 0;
    const pendMem = t.id === "memory" ? state.memory.filter((m) => m.status === "pending" && canSee(m.access, me().role)).length + pendingQuarantine(me().role).length + openGaps(me().role).length : 0;
    const b2 = pend || pendMem ? `<span class="badge amber">${pend || pendMem}</span>` : "";
    return `<button class="tab ${state.tab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}${badge}${b2}</button>`;
  }).join("");

  $("#userSelect").innerHTML = Object.values(USERS).map((u) =>
    `<option value="${u.id}" ${u.id === state.userId ? "selected" : ""}>${u.name} — ${u.roleLabel}</option>`).join("");

  const views = { guide: viewGuide, chat: viewChat, email: viewEmail, store: viewStore, memory: viewMemory, actions: viewActions, sources: viewSources };
  $("#view").innerHTML = views[state.tab]();

  if (state.tab === "chat") {
    const box = $("#messages");
    if (box) box.scrollTop = box.scrollHeight;
    if (state.channel === "brain") state.unread[state.userId] = 0;
  }
}

function viewGuide() {
  const checks = [
    ["Parla per primo", "Apri <b>Chat → 🧠 Brain</b>: c'è il brief delle 08:00 che nessuno ha chiesto. Poi in <b>Store</b> premi <i>Simula evento</i>: un picco di ordini manda i classici sotto scorta e arriva un alert a Magazzino.", "chat"],
    ["La memoria la curano le persone", "In <b>Memoria</b> approva il fatto su DHL. Poi in Chat chiedi: <i>“Quale corriere usiamo per l'estero da dicembre?”</i> (prima dell'approvazione risponde “non lo so”).", "memory"],
    ["Non si fida ciecamente delle fonti", "La battuta sul «50% al Black Friday» in #generale contraddice il -20% approvato: il Brain non la usa, la mette in <b>quarantena</b>. Come Marco (Shop) in <b>Memoria</b> scegli <i>Scarta e dimentica</i> o <i>Accetta</i>. Per un caso live: in <b>Store</b> premi <i>Simula messaggio in contrasto</i> (qualcuno scrive che lo sconto massimo è il 30% e lo applica a un ordine).", "memory"],
    ["Sa chi sta chiedendo", "Chiedi <i>“Qual è il margine di novembre?”</i> come Marco (Shop) e poi come Sara (Magazzino): solo lo Shop ottiene la risposta.", "chat"],
    ["Colma i buchi di conoscenza", "Come Sara (Magazzino) chiedi <i>“Qual è l'ordine minimo per le nocciole?”</i>: non è scritto da nessuna parte, ma è un tema aziendale, quindi il Brain incarica Marco (Shop, fornitori). Passa a Marco → <b>Memoria → Da documentare</b>: scrive il fatto e la domanda a cui risponde. Sara riceve la risposta, e da lì in poi il Brain la sa.", "chat"],
    ["Cita le fonti", "Ogni risposta e ogni punto del brief ha i chip <b>Fonti</b>: cliccali per vedere l'originale (email, chat, doc, task, store).", "chat"],
    ["Ammette i limiti", "Chiedi <i>“Quanti dipendenti ha il nostro concorrente?”</i> oppure <i>“Entro quando ordinare per ricevere prima di Natale?”</i> (c'è solo una bozza non approvata): risponde “Non lo so”.", "chat"],
    ["Propone soltanto", "In <b>Azioni</b> ci sono bozze in attesa (rimborso, pagamento fornitore, quarantena lotto, avvisi ai clienti…). Nulla cambia nello Store finché una persona del reparto giusto non approva.", "actions"],
    ["Si inserisce nella giornata del team", "Chat stile Slack con 6 canali + <b>Email del mattino</b> per ogni persona, in base al suo reparto.", "email"],
  ];
  return `<section class="page">
    <h1>Company Brain — il collega che sa, e parla per primo</h1>
    <p class="muted">Bottega Sabauda è un negozio online torinese specializzato in <b>gianduiotti</b>. Quattro comparti: <b>magazzino</b>, <b>servizio clienti</b>, <b>shop</b> e <b>spedizioni</b> (verso utenti finali e negozi).
    Il Brain osserva email, chat, task, documenti e lo store, mantiene una memoria condivisa curata dal team e avvisa ognuno di ciò che richiede attenzione. Cambia utente in alto a destra.</p>
    <div class="team">${Object.values(USERS).map((u) => `<div class="person"><span class="avatar" style="background:${u.color}">${u.avatar}</span><div><b>${u.name}</b><br><span class="muted">${u.roleLabel}</span></div></div>`).join("")}</div>
    <div class="scenario"><b>Scenario trasversale di oggi (21/11):</b> il laboratorio segnala che il lotto L26-1108 dei Gianduiotti al caffè ha l'etichetta senza l'allergene latte. Tocca <b>tutti e quattro i reparti</b>: Magazzino (quarantena), Shop (stop vendita e promo CAFFE15 + newsletter delle 10:00), Servizio clienti (una cliente allergica ha già scritto, avviso agli acquirenti) e Spedizioni (ordini in preparazione da non evadere). Guarda il brief di ognuno.</div>
    <h2>I check della giuria</h2>
    <ol class="checks">${checks.map(([t, d, tab], i) => `<li><div><b>${i + 1}. ${t}</b><p>${d}</p></div><button class="primary small" data-goto="${tab}">Vai →</button></li>`).join("")}</ol>
  </section>`;
}

function renderMsg(m) {
  if (m.from === "user") {
    const u = USERS[m.userId];
    return `<div class="msg"><span class="avatar" style="background:${u.color}">${u.avatar}</span><div class="msg-body"><div class="msg-head"><b>${u.name}</b> <span class="muted">${m.time}</span></div><div>${esc(m.text)}</div></div></div>`;
  }
  const tag = { brief: `<span class="tag proactive">PROATTIVO · nessuno l'ha chiesto</span>`, alert: `<span class="tag alert">ALERT PROATTIVO</span>`,
    denied: `<span class="tag denied">ACCESSO NEGATO</span>`, unknown: `<span class="tag unknown">NON LO SO</span>`, answer: `<span class="tag ok">DALLA MEMORIA APPROVATA</span>`, gap: `<span class="tag gap">BUCO DI CONOSCENZA · RICHIESTA APERTA</span>`, done: `<span class="tag ok">ESEGUITO DOPO APPROVAZIONE</span>` }[m.kind] || "";
  let body = `<div>${m.text}</div>`;
  if (m.items) body += `<ul class="brief">${m.items.map((it) => `<li>${it.text}${citeChips(it.sources)}</li>`).join("")}</ul>`;
  body += citeChips(m.sources);
  if (m.actionId) body += `<button class="primary small" data-goto="actions">Vedi azione in attesa →</button>`;
  if (m.gapId && state.gaps.find((g) => g.id === m.gapId)?.owner === me().role) body += `<button class="primary small" data-goto="memory">Documenta ora →</button>`;
  return `<div class="msg brain ${m.kind}"><span class="avatar brain-av">🧠</span><div class="msg-body"><div class="msg-head"><b>Brain</b> <span class="app-tag">APP</span> <span class="muted">${m.time}</span> ${tag}</div>${body}</div></div>`;
}

function viewChat() {
  const u = me();
  const channelMsgs = (ch) => liveSources().filter((s) => s.type === "chat" && s.channel === ch && canSee(s.access, u.role)).sort((a, b) => dateKey(a.date) - dateKey(b.date));
  const side = `<aside class="sidebar">
      <div class="ws">Bottega Sabauda</div>
      <div class="side-h">Canali</div>
      ${CHANNELS.map((c) => {
        const locked = !canSee(c.access, u.role);
        return `<button class="side-item ${state.channel === c.id ? "active" : ""}" data-channel="${c.id}" ${locked ? "disabled" : ""}># ${c.id}${locked ? " 🔒" : ""}</button>`;
      }).join("")}
      <div class="side-h">App</div>
      <button class="side-item ${state.channel === "brain" ? "active" : ""}" data-channel="brain">🧠 Brain ${state.unread[u.id] ? `<span class="badge">${state.unread[u.id]}</span>` : ""}</button>
    </aside>`;

  let main;
  if (state.channel === "brain") {
    const suggestions = ["Quale corriere usiamo per l'estero da dicembre?", "Che sconto facciamo per il Black Friday?", "Posso cumulare NATALE10 e BENVENUTO5?", "I gianduiotti contengono latte?", "Come funzionano i rimborsi?", "Qual è lo sconto massimo applicabile a un ordine?", "Qual è l'ordine minimo per le nocciole?","Qual è il margine di novembre?", "Entro quando ordinare per ricevere prima di Natale?", "Quanti dipendenti ha il nostro concorrente?"];
    main = `<div class="chat-main">
      <div class="chat-head"><b>🧠 Brain</b> <span class="muted">· messaggi diretti con ${u.name} (${u.roleLabel})</span></div>
      <div class="messages" id="messages">${state.dm[u.id].map(renderMsg).join("")}</div>
      <div class="suggest">${suggestions.map((q) => `<button class="chip ghost-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <form class="composer" id="askForm"><input id="askInput" autocomplete="off" placeholder="Chiedi qualcosa al Brain…"><button class="primary">Invia</button></form>
    </div>`;
  } else {
    const msgs = channelMsgs(state.channel);
    main = `<div class="chat-main">
      <div class="chat-head"><b># ${state.channel}</b> <span class="muted">· il Brain osserva questo canale</span></div>
      <div class="messages" id="messages">${msgs.length ? msgs.map((s) => {
        const a = USERS[s.from];
        return `<div class="msg"><span class="avatar" style="background:${a.color}">${a.avatar}</span><div class="msg-body"><div class="msg-head"><b>${a.name}</b> <span class="muted">${s.date}</span></div><div>${esc(s.body)}</div></div></div>`;
      }).join("") : `<p class="muted empty">Nessun messaggio recente.</p>`}</div>
      <div class="composer disabled"><input disabled placeholder="Canale simulato (sola lettura)"></div>
    </div>`;
  }
  return `<section class="chat">${side}${main}</section>`;
}

function viewEmail() {
  const u = me();
  const brief = buildBrief(u, state);
  const pendingActions = state.actions.filter((a) => a.status === "pending" && a.owner === u.role);
  return `<section class="page"><div class="mail">
    <div class="mail-head">
      <div><span class="muted">Da:</span> Brain &lt;brain@bottegasabauda.example&gt;</div>
      <div><span class="muted">A:</span> ${u.name} (${u.roleLabel})</div>
      <div><span class="muted">Oggetto:</span> <b>Il tuo brief del 21 novembre</b></div>
      <div class="muted">Inviata automaticamente alle 08:00 · nessuno l'ha richiesta</div>
    </div>
    <div class="mail-body">
      <p>${brief.text}</p>
      <ol>${brief.items.map((it) => `<li>${it.text}${citeChips(it.sources)}</li>`).join("")}</ol>
      ${pendingActions.length ? `<div class="mail-box"><b>In attesa della tua approvazione (${pendingActions.length})</b><ul>${pendingActions.map((a) => `<li>${esc(a.title)}</li>`).join("")}</ul><button class="primary small" data-goto="actions">Apri Azioni →</button></div>` : ""}
      <p class="muted small">Non eseguo nessuna azione senza la tua approvazione. Ogni informazione riporta la fonte da cui proviene.</p>
    </div></div></section>`;
}

const PROBLEM_STATUS = ["In attesa approvazione sconto", "Pagamento fallito", "In attesa pagamento", "Rimborso richiesto", "In giacenza", "Indirizzo errato"];

function viewStore() {
  const low = state.products.filter((p) => p.stock < p.threshold).length;
  const revenue = state.products.reduce((n, p) => n + p.price * p.sold7d, 0);
  const problems = state.orders.filter((o) => PROBLEM_STATUS.includes(o.status) || o.flag).length;
  return `<section class="page">
    <div class="row between"><h1>🛒 Store admin — Bottega Sabauda</h1>
      <div class="row">
        <button class="primary" id="fireEvent" ${state.eventFired ? "disabled" : ""}>⚡ Simula evento: ${SIMULATED_EVENT.label}</button>
        <button class="primary" id="fireConflict" ${state.conflictFired ? "disabled" : ""}>⚡ Simula ${LIVE_CONFLICT.label}</button>
      </div></div>
    <div class="kpis">
      <div class="kpi"><span class="muted">Ordini oggi</span><b>${state.orders.filter((o) => o.date.startsWith("21/11")).length}</b></div>
      <div class="kpi"><span class="muted">Ricavi 7 giorni</span><b>${revenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b></div>
      <div class="kpi ${low ? "warn" : ""}"><span class="muted">Prodotti sotto scorta</span><b>${low}</b></div>
      <div class="kpi ${problems ? "warn" : ""}"><span class="muted">Ordini con problemi</span><b>${problems}</b></div>
    </div>
    <h2>Prodotti</h2>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Prodotto</th><th>Prezzo</th><th>Scorta</th><th>Venduti 7gg</th></tr></thead><tbody>
      ${state.products.map((p) => {
        const pct = Math.min(100, (p.stock / (p.threshold * 3)) * 100);
        const lowCls = p.stock < p.threshold ? "low" : "";
        return `<tr class="${lowCls}"><td>${p.sku}</td><td>${p.name}${p.blocked ? ` <span class="tag denied">VENDITA SOSPESA</span>` : ""}</td><td>${p.price.toFixed(2)}€</td>
          <td><div class="stock"><div class="bar"><span style="width:${pct}%"></span></div>${p.stock} pz ${lowCls ? "⚠️" : ""}${p.incoming ? ` <span class="tag ok">+${p.incoming} in arrivo</span>` : ""}</div></td><td>${p.sold7d}</td></tr>`;
      }).join("")}
    </tbody></table></div>
    <h2>Ordini <span class="muted">(${state.orders.length} recenti, dal più nuovo)</span></h2>
    <div class="table-wrap tall"><table><thead><tr><th>Ordine</th><th>Cliente</th><th>Tipo</th><th>Paese</th><th>Totale</th><th>Stato</th><th>Corriere</th><th>Data</th><th>Note</th></tr></thead><tbody>
      ${state.orders.map((o) => `<tr><td>${o.id}</td><td>${esc(o.customer)}</td><td>${o.kind === "B2B" ? `<span class="tag proactive">NEGOZIO</span>` : "Privato"}</td><td>${o.country}</td><td>${o.total.toFixed(2)}€</td><td><span class="status s-${norm(o.status).replace(/\s+/g, "-")}">${o.status}</span></td><td>${o.carrier || "—"}</td><td>${o.date}</td><td class="muted">${esc(o.flag)}</td></tr>`).join("")}
    </tbody></table></div>
    ${state.log.length ? `<h2>Registro azioni eseguite</h2><ul class="log">${state.log.map((l) => `<li><span class="muted">${l.time}</span> ${esc(l.text)}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function viewMemory() {
  const u = me();
  const groups = [["pending", "Da revisionare"], ["approved", "Approvata — usata per rispondere"], ["rejected", "Rifiutata — mai usata"]];
  const card = (m) => {
    const visible = canSee(m.access, u.role);
    if (!visible) return `<div class="mem locked">🔒 Elemento riservato a ${roleList(m.access)}</div>`;
    return `<div class="mem ${m.status}">
      ${m.question ? `<div class="muted small">❓ Risponde a: «${esc(m.question)}»</div>` : ""}
      <div class="mem-text">${esc(m.text)}</div>
      <div class="mem-meta muted">Proposto da ${m.proposedBy} · visibile a: ${roleList(m.access)}${m.approvedBy ? ` · approvato da ${m.approvedBy}` : ""}${m.rejectedBy ? ` · rifiutato da ${m.rejectedBy}` : ""}</div>
      ${citeChips(m.sourceIds)}
      ${m.status === "pending" ? `<div class="row"><button class="primary small" data-mem-approve="${m.id}">✓ Approva</button><button class="danger small" data-mem-reject="${m.id}">✕ Rifiuta</button></div>` : ""}
    </div>`;
  };
  const gapCard = (g) => {
    const asker = USERS[g.askedBy];
    const mine = g.owner === u.role;
    const status = { open: `<span class="tag gap">DA DOCUMENTARE</span>`, answered: `<span class="tag ok">DOCUMENTATA da ${esc(g.decidedBy)}</span>`, dismissed: `<span class="tag unknown">CHIUSA da ${esc(g.decidedBy)} · informazione non esistente</span>` }[g.status];
    const head = `<div class="row between"><b>«${esc(g.question)}»</b>${status}</div>
      <div class="muted small">Chiesto da ${esc(asker.name)} (${asker.roleLabel}) alle ${g.time} · assegnato a ${ROLE_LABELS[g.owner]} (${esc(g.topicLabel)})</div>`;
    if (!mine || g.status !== "open") return `<div class="gapc ${g.status} ${mine ? "" : "locked"}">${head}${g.status === "answered" ? `<div>${esc(g.answer)}</div>` : ""}</div>`;
    const other = asker.role !== u.role ? `<option value="${u.role},${asker.role}">Solo ${ROLE_LABELS[u.role]} e ${ROLE_LABELS[asker.role]}</option>` : "";
    return `<div class="gapc open">${head}
      <label class="small muted">Il fatto (la risposta)</label>
      <textarea id="gap-fact-${g.id}" rows="2" placeholder="es. Ordine minimo nocciole alla Cooperativa Nocciola Langhe: 100 kg, in multipli di 25 kg, consegna diretta al laboratorio."></textarea>
      <label class="small muted">La domanda a cui risponde (serve al Brain per ritrovarlo)</label>
      <input id="gap-q-${g.id}" value="${esc(g.question)}">
      <div class="row"><label class="small muted">Chi può vederlo</label>
        <select id="gap-acc-${g.id}"><option value="all">Tutti i reparti</option>${other}<option value="${u.role}">Solo ${ROLE_LABELS[u.role]}</option></select></div>
      <div class="row"><button class="primary small" data-gap-save="${g.id}">✓ Salva in memoria</button><button class="danger small" data-gap-dismiss="${g.id}">✕ Non esiste / non è di mia competenza</button></div>
    </div>`;
  };
  const quarCard = (q) => {
    const mem = state.memory.find((m) => m.id === q.memoryId);
    const mine = q.authority.includes(u.role);
    if (!mine) return `<div class="quar locked">🔒 Informazione in contrasto con la memoria — ${q.status === "pending" ? "in attesa di" : "decisa da"} ${roleList(q.authority)}</div>`;
    const tag = { pending: `<span class="tag alert">IN QUARANTENA · NON USATA</span>`, banned: `<span class="tag denied">SCARTATA E DIMENTICATA da ${q.decidedBy}</span>`, accepted: `<span class="tag ok">ACCETTATA da ${q.decidedBy} · memoria aggiornata</span>` }[q.status];
    return `<div class="quar ${q.status}">
      <div class="row between"><b>Informazione in contrasto con la memoria</b>${tag}</div>
      <div><span class="muted">Nuova (non verificata):</span> «${esc(q.claim.text)}»</div>
      ${citeChips([q.sourceId])}
      <div><span class="muted">In memoria (approvata da ${esc(mem.approvedBy || "il team")}):</span> ${esc(mem.text)}</div>
      ${q.orderId ? `<div class="muted">⚠️ Qualcuno l'ha già applicata all'ordine <b>${q.orderId}</b>, ora in attesa di approvazione.</div>` : ""}
      ${q.status === "pending" ? `<div class="row"><button class="danger small" data-quar-ban="${q.id}">🚫 Scarta e dimentica</button><button class="primary small" data-quar-accept="${q.id}">✓ Accetta e aggiorna la memoria</button></div>` : ""}
    </div>`;
  };
  return `<section class="page"><h1>🧠 Memoria condivisa</h1>
    <p class="muted">Il Brain estrae fatti dalle fonti e li propone. Solo gli elementi <b>approvati</b> da una persona vengono usati per rispondere. Le informazioni che <b>contraddicono</b> la memoria approvata non vengono mai usate: finiscono in quarantena per chi ha l'autorità di decidere.</p>
    ${state.gaps.length ? `<h2>📝 Da documentare <span class="muted">(${state.gaps.filter((g) => g.status === "open").length} aperte)</span></h2>
      <p class="muted small">Domande a cui il Brain non sapeva rispondere ma che qualcuno in azienda conosce. La persona competente scrive il fatto e la domanda a cui risponde: entra subito in memoria, a sua firma.</p>
      ${state.gaps.map(gapCard).join("")}` : ""}
    ${state.quarantine.length ? `<h2>🛡️ Quarantena <span class="muted">(${state.quarantine.filter((q) => q.status === "pending").length} da decidere)</span></h2>${state.quarantine.map(quarCard).join("")}` : ""}
    ${groups.map(([st, label]) => {
      const list = state.memory.filter((m) => m.status === st);
      return `<h2>${label} <span class="muted">(${list.length})</span></h2>${list.length ? list.map(card).join("") : `<p class="muted">Nessun elemento.</p>`}`;
    }).join("")}
  </section>`;
}

function viewActions() {
  const u = me();
  const card = (a) => {
    const mine = a.owner === u.role;
    if (!mine) return `<div class="action locked">🔒 Azione di competenza ${ROLE_LABELS[a.owner]} — ${a.status === "pending" ? "in attesa" : a.status === "executed" ? "eseguita" : "rifiutata"}</div>`;
    const statusTag = { pending: `<span class="tag alert">IN ATTESA DI APPROVAZIONE</span>`, executed: `<span class="tag ok">ESEGUITA · approvata da ${a.decidedBy}</span>`, rejected: `<span class="tag denied">RIFIUTATA da ${a.decidedBy}</span>` }[a.status];
    return `<div class="action ${a.status}">
      <div class="row between"><b>${esc(a.title)}</b>${statusTag}</div>
      <p><span class="muted">Perché:</span> ${esc(a.why)}</p>
      <pre class="draft">${esc(a.draft)}</pre>
      ${citeChips(a.sourceIds)}
      ${a.status === "pending" ? `<div class="row"><button class="primary small" data-act-approve="${a.id}">✓ Approva ed esegui</button><button class="danger small" data-act-reject="${a.id}">✕ Rifiuta</button></div>` : ""}
    </div>`;
  };
  return `<section class="page"><h1>✅ Azioni proposte</h1>
    <p class="muted">Il Brain <b>propone soltanto</b>: prepara bozze, ma nulla viene inviato o modificato finché una persona del ruolo giusto non approva.</p>
    ${state.actions.map(card).join("")}
  </section>`;
}

function viewSources() {
  const u = me();
  const all = liveSources();
  const visible = all.filter((s) => canSee(s.access, u.role)).sort((a, b) => dateKey(b.date) - dateKey(a.date));
  const hidden = all.length - visible.length;
  return `<section class="page"><h1>📁 Fonti osservate</h1>
    <p class="muted">Email, chat, task e documenti che il Brain legge. Vedi solo quelle accessibili al ruolo <b>${u.roleLabel}</b>${hidden ? ` (${hidden} riservate ad altri team)` : ""}.</p>
    <div class="table-wrap tall"><table><thead><tr><th>Tipo</th><th>Titolo</th><th>Da</th><th>Data</th><th>Accesso</th></tr></thead><tbody>
      ${visible.map((s) => `<tr class="clickable" data-source="${s.id}"><td>${TYPE_ICON[s.type]} ${s.type}</td><td>${esc(s.title)}${state.banned[s.id] ? ` <span class="tag denied">BANDITA</span>` : ""}${state.quarantine.some((q) => q.sourceId === s.id && q.status === "pending") ? ` <span class="tag alert">IN QUARANTENA</span>` : ""}</td><td>${esc(who(s.from))}</td><td>${s.date}</td><td>${roleList(s.access)}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

function openSource(id) {
  const s = getSource(id);
  const body = canSee(s.access, me().role)
    ? `<div class="muted">${TYPE_ICON[s.type]} ${s.type.toUpperCase()} · ${esc(who(s.from))}${s.to ? ` → ${esc(who(s.to))}` : ""} · ${s.date}</div><h2>${esc(s.title)}</h2><p class="pre">${esc(s.body)}</p>`
    : `<h2>🔒 Fonte riservata</h2><p>Questa fonte è accessibile solo a ${roleList(s.access)}.</p>`;
  $("#modalBody").innerHTML = body;
  $("#modal").hidden = false;
}

// ---------- events ----------
function pushBrain(userId, msg) {
  state.dm[userId].push({ time: now(), ...msg });
  if (!(state.userId === userId && state.tab === "chat" && state.channel === "brain")) state.unread[userId] = (state.unread[userId] || 0) + 1;
}

function ask(text) {
  if (!text.trim()) return;
  const u = me();
  state.dm[u.id].push({ from: "user", userId: u.id, text, time: now() });
  state.dm[u.id].push({ time: now(), ...askBrain(text, u) });
  render();
}

function decideAction(id, approve) {
  const a = state.actions.find((x) => x.id === id);
  a.status = approve ? "executed" : "rejected";
  a.decidedBy = me().name;
  if (approve) {
    // Side effects on the store state, driven by the action's `effect` (see ACTIONS in data.js).
    const order = a.orderId && state.orders.find((o) => o.id === a.orderId);
    const product = a.sku && state.products.find((p) => p.sku === a.sku);
    if (a.effect === "refund") order.status = "Rimborsato";
    if (a.effect === "intercept") order.status = "Intercettato";
    if (a.effect === "reorder") product.incoming = (product.incoming || 0) + a.qty;
    if (a.effect === "block") product.blocked = true;
    state.log.unshift({ time: now(), text: `${me().name} ha approvato: ${a.title}` });
    pushBrain(state.userId, { from: "brain", kind: "done", text: `Fatto: <b>${esc(a.title)}</b>. L'ho eseguito solo dopo la tua approvazione.`, sources: a.sourceIds });
  } else {
    state.log.unshift({ time: now(), text: `${me().name} ha rifiutato: ${a.title} (nessuna modifica)` });
  }
  render();
}

// Authorised person decides on a quarantined claim.
//  ban    -> the source is banned and forgotten; the order that used the wrong info is corrected.
//  accept -> the approved memory is updated with the new value.
function decideQuarantine(id, accept) {
  const q = state.quarantine.find((x) => x.id === id);
  const mem = state.memory.find((m) => m.id === q.memoryId);
  const order = q.orderId && state.orders.find((o) => o.id === q.orderId);
  q.decidedBy = me().name;
  if (accept) {
    q.status = "accepted";
    mem.text = q.claim.text;
    mem.fact.value = q.claim.value;
    mem.approvedBy = me().name;
    mem.sourceIds = [...new Set([...mem.sourceIds, q.sourceId])];
    if (order) { order.status = "In preparazione"; order.flag = "Sconto approvato dallo Shop"; }
    state.log.unshift({ time: now(), text: `${me().name} ha accettato dalla quarantena: «${q.claim.text}» (memoria aggiornata)` });
    pushBrain(state.userId, { from: "brain", kind: "done", text: `Ho aggiornato la memoria: <b>${esc(q.claim.text)}</b> Da ora risponderò così.`, sources: [q.sourceId] });
  } else {
    q.status = "banned";
    state.banned[q.sourceId] = true;
    if (order) {
      order.status = "In preparazione"; order.total = LIVE_CONFLICT.correctTotal; order.flag = LIVE_CONFLICT.correctFlag;
    }
    state.log.unshift({ time: now(), text: `${me().name} ha scartato dalla quarantena: «${q.claim.text}» (fonte bandita)${order ? `; ordine ${order.id} riportato a ${order.total.toFixed(2)}€` : ""}` });
    pushBrain(state.userId, { from: "brain", kind: "done", text: `Scartata e dimenticata: <b>${esc(q.claim.text)}</b> Non la userò mai.${order ? ` Ho riportato l'ordine ${order.id} allo sconto del 20% (${order.total.toFixed(2)}€).` : ""}`, sources: [q.sourceId] });
  }
  render();
}

// The competent person fills a knowledge gap: the fact + the question it answers become approved memory
// (written by the authorised person), backed by a note source; the asker is notified.
function saveGap(id) {
  const g = state.gaps.find((x) => x.id === id);
  const fact = $(`#gap-fact-${id}`).value.trim();
  const question = $(`#gap-q-${id}`).value.trim() || g.question;
  if (!fact) { toast("Scrivi il fatto prima di salvarlo."); return; }
  const access = $(`#gap-acc-${id}`).value.split(",");
  const u = me();
  const src = { id: `kn-${id}`, type: "note", title: `Risposta di ${u.name}: ${question}`, from: u.id, date: `21/11 ${now()}`, access, body: fact };
  state.extraSources.push(src);
  const mem = { id: `K${state.memory.filter((m) => m.id.startsWith("K")).length + 1}`, text: fact, question, sourceIds: [src.id], access,
    status: "approved", proposedBy: u.name, approvedBy: u.name, keywords: deriveKeywords(question), minScore: 2 };
  state.memory.push(mem);
  Object.assign(g, { status: "answered", answer: fact, decidedBy: u.name });
  state.log.unshift({ time: now(), text: `${u.name} ha documentato: «${question}»` });
  const asker = USERS[g.askedBy];
  const msg = { from: "brain", kind: "answer", sources: [src.id],
    text: `📝 <b>${esc(u.name)}</b> ha risposto alla tua domanda «${esc(g.question)}»:<br>${esc(fact)}<br><span class="muted">L'ho aggiunto alla memoria: da ora lo so anche io.</span>` };
  if (canSee(access, asker.role)) pushBrain(asker.id, msg);
  else pushBrain(asker.id, { from: "brain", kind: "denied", text: `${esc(u.name)} ha documentato la risposta a «${esc(g.question)}», ma l'ha resa visibile solo a ${roleList(access)}.` });
  if (asker.id !== u.id) pushBrain(u.id, { from: "brain", kind: "done", text: `Grazie! Ho salvato in memoria la risposta a «${esc(question)}» e ho avvisato ${esc(asker.name)}.`, sources: [src.id] });
  render();
}

function dismissGap(id) {
  const g = state.gaps.find((x) => x.id === id);
  Object.assign(g, { status: "dismissed", decidedBy: me().name });
  state.log.unshift({ time: now(), text: `${me().name} ha chiuso la richiesta «${g.question}» (informazione non esistente)` });
  if (g.askedBy !== me().id) pushBrain(g.askedBy, { from: "brain", kind: "unknown", text: `${esc(me().name)} ha chiuso la tua domanda «${esc(g.question)}»: l'informazione non esiste o non è di sua competenza. Continuo a non saperlo, e non invento.` });
  render();
}

function fireConflict() {
  state.conflictFired = true;
  state.orders.unshift(structuredClone(LIVE_CONFLICT.order));
  const created = detectConflicts(state);
  for (const q of created) {
    for (const u of Object.values(USERS).filter((x) => q.authority.includes(x.role))) {
      pushBrain(u.id, { from: "brain", kind: "alert", sources: [q.sourceId],
        text: `<b>🛡️ Informazione in contrasto con la memoria</b><br>In #clienti ${esc(who(SOURCES.find((s) => s.id === q.sourceId).from))} scrive che «${esc(q.claim.text)}» e l'ha applicata all'ordine ${q.orderId}. In memoria risulta il <b>${esc(state.memory.find((m) => m.id === q.memoryId).fact.value)}</b>. Non l'ho usata: l'ho messa in quarantena, decidi in <i>Memoria</i> se scartarla o accettarla.` });
    }
  }
  toast(`Il Brain non si è fidato del messaggio: l'ha messo in quarantena per ${roleList(created[0]?.authority || [])}.`);
  render();
}

function decideMemory(id, approve) {
  const m = state.memory.find((x) => x.id === id);
  m.status = approve ? "approved" : "rejected";
  if (approve) m.approvedBy = me().name; else m.rejectedBy = me().name;
  render();
}

function fireEvent() {
  state.eventFired = true;
  SIMULATED_EVENT.apply(state);
  state.actions.push(structuredClone(SIMULATED_EVENT.action));
  const al = SIMULATED_EVENT.alert;
  for (const u of Object.values(USERS).filter((x) => x.role === al.target)) {
    pushBrain(u.id, { from: "brain", kind: "alert", text: `<b>${al.title}</b><br>${al.text}`, sources: al.sourceIds, actionId: SIMULATED_EVENT.action.id });
  }
  toast(`Il Brain ha notificato ${userWithRole(al.target).name} (${ROLE_LABELS[al.target]}) senza che nessuno chiedesse nulla.`);
  render();
}

function toast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `🧠 ${esc(text)}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, tr.clickable");
  if (!t) return;
  const d = t.dataset;
  if (d.tab) { state.tab = d.tab; render(); }
  else if (d.goto) { state.tab = d.goto; if (d.goto === "chat") state.channel = "brain"; render(); }
  else if (d.channel) { state.channel = d.channel; render(); }
  else if (d.source) openSource(d.source);
  else if (d.ask) ask(d.ask);
  else if (d.memApprove) decideMemory(d.memApprove, true);
  else if (d.memReject) decideMemory(d.memReject, false);
  else if (d.actApprove) decideAction(d.actApprove, true);
  else if (d.actReject) decideAction(d.actReject, false);
  else if (d.quarBan) decideQuarantine(d.quarBan, false);
  else if (d.quarAccept) decideQuarantine(d.quarAccept, true);
  else if (t.id === "fireConflict") fireConflict();
  else if (d.gapSave) saveGap(d.gapSave);
  else if (d.gapDismiss) dismissGap(d.gapDismiss);
  else if (t.id === "fireEvent") fireEvent();
  else if (t.id === "modalClose") $("#modal").hidden = true;
  else if (t.id === "resetBtn") { state = initialState(); render(); }
});

document.addEventListener("submit", (e) => {
  if (e.target.id === "askForm") { e.preventDefault(); ask($("#askInput").value); }
});

$("#userSelect").addEventListener("change", (e) => { state.userId = e.target.value; state.channel = "brain"; render(); });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });

state = initialState();
render();
