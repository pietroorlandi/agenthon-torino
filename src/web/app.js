// Company Brain — demo UI (step 1: fully client-side, mock answer engine).
// The function `askBrain()` is the single point to swap with a Gemini backend later.

const TABS = [
  { id: "guide",   label: "🎯 Guida demo" },
  { id: "chat",    label: "💬 Chat" },
  { id: "email",   label: "📧 Email del mattino" },
  { id: "store",   label: "🛒 Store" },
  { id: "memory",  label: "🧠 Memoria" },
  { id: "actions", label: "✅ Azioni" },
  { id: "sources", label: "📁 Fonti" },
];

const CHANNELS = ["generale", "ordini", "tech", "finance"];

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
    dm: {},
    unread: {},
    log: [],
    eventFired: false,
  };
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

function getSource(id) {
  if (id.startsWith("STORE-")) {
    const sku = id.slice(6);
    const p = state.products.find((x) => x.sku === sku);
    return { id, type: "store", title: `Store admin — scorte ${sku}`, from: "sistema", date: "live", access: ["all"],
      body: `${p.name}: ${p.stock} pz in magazzino (soglia ${p.threshold}), ${p.sold7d} venduti negli ultimi 7 giorni.` };
  }
  return SOURCES.find((s) => s.id === id);
}

const TYPE_ICON = { email: "📧", chat: "💬", doc: "📄", task: "☑️", store: "🛒" };

function citeChips(ids) {
  if (!ids?.length) return "";
  return `<div class="cites"><span class="muted">Fonti:</span> ${ids.map((id) => {
    const s = getSource(id);
    return `<button class="chip" data-source="${id}">${TYPE_ICON[s.type]} ${esc(s.title)}</button>`;
  }).join("")}</div>`;
}

// ---------- proactive brief (the Brain speaks first) ----------
function buildBrief(user, s) {
  const items = [];
  const pendingMem = s.memory.filter((m) => m.status === "pending" && canSee(m.access, user.role)).length;

  if (user.role === "finance") {
    items.push({ text: "<b>Fattura n. 889 scaduta</b> (3.450€, fornitore cioccolato) — è arrivato un sollecito. Ho preparato il pagamento: è in <i>Azioni</i>, aspetta la tua approvazione.", sources: ["S6"] });
    items.push({ text: "Margine lordo di novembre al <b>38,4%</b>. Il vermouth resta il prodotto più redditizio (52%).", sources: ["S3"] });
  }
  if (user.role === "tech") {
    items.push({ text: "<b>Errori 502 dal gateway di pagamento</b> sugli ordini esteri da stanotte. Probabilmente collegato all'ordine #10480 (DE) con pagamento fallito.", sources: ["S4"] });
    items.push({ text: "Il task <b>Migrazione API pagamenti</b> scade il 25/11 ed è al 60%.", sources: ["S5"] });
  }
  if (user.role === "ops") {
    items.push({ text: "Il cliente dell'ordine <b>#10478</b> chiede un rimborso per grissini rotti. Rientra nella policy (sotto 100€): la bozza è in <i>Azioni</i>.", sources: ["S7", "S8"] });
    items.push({ text: "<b>Nocciole IGP sotto scorta</b> (18 pz, soglia 25).", sources: ["STORE-NOC-IGP"] });
    items.push({ text: "È arrivata un'email sul <b>nuovo corriere per l'estero da dicembre</b>. Ne ho estratto un fatto: va revisionato in <i>Memoria</i>.", sources: ["S1"] });
  }
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
  const best = (list) => list.map((m) => ({ m, score: scoreItem(m, q) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0]?.m;

  const approved = best(state.memory.filter((m) => m.status === "approved"));
  if (approved) {
    if (!canSee(approved.access, user.role)) {
      const owners = approved.access.map((r) => ROLE_LABELS[r]).join(", ");
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
  }
  return { from: "brain", kind: "unknown", text };
}

// ---------- rendering ----------
function render() {
  $("#tabs").innerHTML = TABS.map((t) => {
    const badge = t.id === "chat" && state.unread[state.userId] ? `<span class="badge">${state.unread[state.userId]}</span>` : "";
    const pend = t.id === "actions" ? state.actions.filter((a) => a.status === "pending" && a.owner === me().role).length : 0;
    const pendMem = t.id === "memory" ? state.memory.filter((m) => m.status === "pending" && canSee(m.access, me().role)).length : 0;
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
    ["Parla per primo", "Apri <b>Chat → 🧠 Brain</b>: c'è il brief delle 08:00 che nessuno ha chiesto. Poi in <b>Store</b> premi <i>Simula evento</i>: arriva un alert a Operations.", "chat"],
    ["La memoria la curano le persone", "In <b>Memoria</b> approva il fatto su DHL e rifiuta quello sul 50% di sconto. Poi in Chat chiedi: <i>“Quale corriere usiamo per l'estero da dicembre?”</i> (prima dell'approvazione risponde “non lo so”).", "memory"],
    ["Sa chi sta chiedendo", "Chiedi <i>“Qual è il margine di novembre?”</i> come Giulia (Finance) e poi come Marco (Tech): solo Finance ottiene la risposta.", "chat"],
    ["Cita le fonti", "Ogni risposta e ogni punto del brief ha i chip <b>Fonti</b>: cliccali per vedere l'originale.", "chat"],
    ["Ammette i limiti", "Chiedi <i>“Quanti dipendenti ha il nostro concorrente?”</i>: risponde “Non lo so”.", "chat"],
    ["Propone soltanto", "In <b>Azioni</b> ci sono bozze in attesa. Nulla cambia nello Store finché una persona non approva.", "actions"],
    ["Si inserisce nella giornata del team", "Chat stile Slack + <b>Email del mattino</b> per ogni persona.", "email"],
  ];
  return `<section class="page">
    <h1>Company Brain — il collega che sa, e parla per primo</h1>
    <p class="muted">Bottega Sabauda è un e-commerce torinese di prodotti tipici. Il Brain osserva email, chat, task, documenti e lo store,
    mantiene una memoria condivisa curata dal team e avvisa ognuno di ciò che richiede attenzione. Cambia utente in alto a destra.</p>
    <div class="team">${Object.values(USERS).map((u) => `<div class="person"><span class="avatar" style="background:${u.color}">${u.avatar}</span><div><b>${u.name}</b><br><span class="muted">${u.roleLabel}</span></div></div>`).join("")}</div>
    <h2>I 7 check della giuria</h2>
    <ol class="checks">${checks.map(([t, d, tab], i) => `<li><div><b>${i + 1}. ${t}</b><p>${d}</p></div><button class="primary small" data-goto="${tab}">Vai →</button></li>`).join("")}</ol>
  </section>`;
}

function renderMsg(m) {
  if (m.from === "user") {
    const u = USERS[m.userId];
    return `<div class="msg"><span class="avatar" style="background:${u.color}">${u.avatar}</span><div class="msg-body"><div class="msg-head"><b>${u.name}</b> <span class="muted">${m.time}</span></div><div>${esc(m.text)}</div></div></div>`;
  }
  const tag = { brief: `<span class="tag proactive">PROATTIVO · nessuno l'ha chiesto</span>`, alert: `<span class="tag alert">ALERT PROATTIVO</span>`,
    denied: `<span class="tag denied">ACCESSO NEGATO</span>`, unknown: `<span class="tag unknown">NON LO SO</span>`, answer: `<span class="tag ok">DALLA MEMORIA APPROVATA</span>`, done: `<span class="tag ok">ESEGUITO DOPO APPROVAZIONE</span>` }[m.kind] || "";
  let body = `<div>${m.text}</div>`;
  if (m.items) body += `<ul class="brief">${m.items.map((it) => `<li>${it.text}${citeChips(it.sources)}</li>`).join("")}</ul>`;
  body += citeChips(m.sources);
  if (m.actionId) body += `<button class="primary small" data-goto="actions">Vedi azione in attesa →</button>`;
  return `<div class="msg brain ${m.kind}"><span class="avatar brain-av">🧠</span><div class="msg-body"><div class="msg-head"><b>Brain</b> <span class="app-tag">APP</span> <span class="muted">${m.time}</span> ${tag}</div>${body}</div></div>`;
}

function viewChat() {
  const u = me();
  const channelMsgs = (ch) => SOURCES.filter((s) => s.type === "chat" && s.channel === ch && canSee(s.access, u.role));
  const side = `<aside class="sidebar">
      <div class="ws">Bottega Sabauda</div>
      <div class="side-h">Canali</div>
      ${CHANNELS.map((c) => {
        const locked = c === "tech" && u.role !== "tech" || c === "finance" && u.role !== "finance";
        return `<button class="side-item ${state.channel === c ? "active" : ""}" data-channel="${c}" ${locked ? "disabled" : ""}># ${c}${locked ? " 🔒" : ""}</button>`;
      }).join("")}
      <div class="side-h">App</div>
      <button class="side-item ${state.channel === "brain" ? "active" : ""}" data-channel="brain">🧠 Brain ${state.unread[u.id] ? `<span class="badge">${state.unread[u.id]}</span>` : ""}</button>
    </aside>`;

  let main;
  if (state.channel === "brain") {
    const suggestions = ["Quale corriere usiamo per l'estero da dicembre?", "Qual è il margine di novembre?", "Come funzionano i rimborsi?", "Come si fa il deploy del sito?", "Che sconto facciamo per il Black Friday?", "Quanti dipendenti ha il nostro concorrente?"];
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
      <div><span class="muted">Oggetto:</span> <b>Il tuo brief di venerdì 21 novembre</b></div>
      <div class="muted">Inviata automaticamente alle 08:00 · nessuno l'ha richiesta</div>
    </div>
    <div class="mail-body">
      <p>${brief.text}</p>
      <ol>${brief.items.map((it) => `<li>${it.text}${citeChips(it.sources)}</li>`).join("")}</ol>
      ${pendingActions.length ? `<div class="mail-box"><b>In attesa della tua approvazione (${pendingActions.length})</b><ul>${pendingActions.map((a) => `<li>${esc(a.title)}</li>`).join("")}</ul><button class="primary small" data-goto="actions">Apri Azioni →</button></div>` : ""}
      <p class="muted small">Non eseguo nessuna azione senza la tua approvazione. Ogni informazione riporta la fonte da cui proviene.</p>
    </div></div></section>`;
}

function viewStore() {
  const low = state.products.filter((p) => p.stock < p.threshold).length;
  const revenue = state.products.reduce((n, p) => n + p.price * p.sold7d, 0);
  return `<section class="page">
    <div class="row between"><h1>🛒 Store admin — Bottega Sabauda</h1>
      <button class="primary" id="fireEvent" ${state.eventFired ? "disabled" : ""}>⚡ Simula evento: ${SIMULATED_EVENT.label}</button></div>
    <div class="kpis">
      <div class="kpi"><span class="muted">Ordini oggi</span><b>${state.orders.filter((o) => o.date.startsWith("21/11")).length}</b></div>
      <div class="kpi"><span class="muted">Ricavi 7 giorni</span><b>${revenue.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b></div>
      <div class="kpi ${low ? "warn" : ""}"><span class="muted">Prodotti sotto scorta</span><b>${low}</b></div>
    </div>
    <h2>Prodotti</h2>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Prodotto</th><th>Prezzo</th><th>Scorta</th><th>Venduti 7gg</th></tr></thead><tbody>
      ${state.products.map((p) => {
        const pct = Math.min(100, (p.stock / (p.threshold * 3)) * 100);
        const lowCls = p.stock < p.threshold ? "low" : "";
        return `<tr class="${lowCls}"><td>${p.sku}</td><td>${p.name}</td><td>${p.price.toFixed(2)}€</td>
          <td><div class="stock"><div class="bar"><span style="width:${pct}%"></span></div>${p.stock} pz ${lowCls ? "⚠️" : ""}${p.incoming ? ` <span class="tag ok">+${p.incoming} in arrivo</span>` : ""}</div></td><td>${p.sold7d}</td></tr>`;
      }).join("")}
    </tbody></table></div>
    <h2>Ultimi ordini</h2>
    <div class="table-wrap"><table><thead><tr><th>Ordine</th><th>Cliente</th><th>Paese</th><th>Totale</th><th>Stato</th><th>Data</th></tr></thead><tbody>
      ${state.orders.map((o) => `<tr><td>${o.id}</td><td>${o.customer}</td><td>${o.country}</td><td>${o.total.toFixed(2)}€</td><td><span class="status s-${norm(o.status).replace(/\s+/g, "-")}">${o.status}</span></td><td>${o.date}</td></tr>`).join("")}
    </tbody></table></div>
    ${state.log.length ? `<h2>Registro azioni eseguite</h2><ul class="log">${state.log.map((l) => `<li><span class="muted">${l.time}</span> ${esc(l.text)}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function viewMemory() {
  const u = me();
  const groups = [["pending", "Da revisionare"], ["approved", "Approvata — usata per rispondere"], ["rejected", "Rifiutata — mai usata"]];
  const card = (m) => {
    const visible = canSee(m.access, u.role);
    if (!visible) return `<div class="mem locked">🔒 Elemento riservato a ${m.access.map((r) => ROLE_LABELS[r]).join(", ")}</div>`;
    return `<div class="mem ${m.status}">
      <div class="mem-text">${esc(m.text)}</div>
      <div class="mem-meta muted">Proposto da ${m.proposedBy} · visibile a: ${m.access.map((r) => ROLE_LABELS[r]).join(", ")}${m.approvedBy ? ` · approvato da ${m.approvedBy}` : ""}${m.rejectedBy ? ` · rifiutato da ${m.rejectedBy}` : ""}</div>
      ${citeChips(m.sourceIds)}
      ${m.status === "pending" ? `<div class="row"><button class="primary small" data-mem-approve="${m.id}">✓ Approva</button><button class="danger small" data-mem-reject="${m.id}">✕ Rifiuta</button></div>` : ""}
    </div>`;
  };
  return `<section class="page"><h1>🧠 Memoria condivisa</h1>
    <p class="muted">Il Brain estrae fatti dalle fonti e li propone. Solo gli elementi <b>approvati</b> da una persona vengono usati per rispondere.</p>
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
  const visible = SOURCES.filter((s) => canSee(s.access, u.role));
  const hidden = SOURCES.length - visible.length;
  return `<section class="page"><h1>📁 Fonti osservate</h1>
    <p class="muted">Email, chat, task e documenti che il Brain legge. Vedi solo quelle accessibili al ruolo <b>${u.roleLabel}</b>${hidden ? ` (${hidden} riservate ad altri team)` : ""}.</p>
    <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Titolo</th><th>Da</th><th>Data</th><th>Accesso</th></tr></thead><tbody>
      ${visible.map((s) => `<tr class="clickable" data-source="${s.id}"><td>${TYPE_ICON[s.type]} ${s.type}</td><td>${esc(s.title)}</td><td>${esc(USERS[s.from]?.name || s.from)}</td><td>${s.date}</td><td>${s.access.map((r) => ROLE_LABELS[r]).join(", ")}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

function openSource(id) {
  const s = getSource(id);
  const body = canSee(s.access, me().role)
    ? `<div class="muted">${TYPE_ICON[s.type]} ${s.type.toUpperCase()} · ${esc(USERS[s.from]?.name || s.from)} · ${s.date}</div><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>`
    : `<h2>🔒 Fonte riservata</h2><p>Questa fonte è accessibile solo a ${s.access.map((r) => ROLE_LABELS[r]).join(", ")}.</p>`;
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
    if (a.effect === "refund") state.orders.find((o) => o.id === "#10478").status = "Rimborsato";
    if (a.effect === "reorder") state.products.find((p) => p.sku === "GIA-250").incoming = 200;
    state.log.unshift({ time: now(), text: `${me().name} ha approvato: ${a.title}` });
    pushBrain(state.userId, { from: "brain", kind: "done", text: `Fatto: <b>${esc(a.title)}</b>. L'ho eseguito solo dopo la tua approvazione.`, sources: a.sourceIds });
  } else {
    state.log.unshift({ time: now(), text: `${me().name} ha rifiutato: ${a.title} (nessuna modifica)` });
  }
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
