import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbNKlWYSe1rIn1t5yFS8kgJlwWggn5eLQ",
  authDomain: "sugestoes-f03d9.firebaseapp.com",
  projectId: "sugestoes-f03d9",
  storageBucket: "sugestoes-f03d9.firebasestorage.app",
  messagingSenderId: "640972402801",
  appId: "1:640972402801:web:c1aaf57020fb7e1f05abd0"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const colRef = collection(db, "sugestoes");

// ── Estado ────────────────────────────────────────────────────
let data         = [];
let sortCol      = 'id';
let sortAsc      = false;
let currentTab   = localStorage.getItem('active-tab') || 'ativas';
let activeFilters = { prioridade: [], feedback: [] };
let viewMode     = localStorage.getItem('view-mode') || 'table';
let compactCards = localStorage.getItem('compact-cards') === 'true';
let customCardOrder = JSON.parse(localStorage.getItem('card-order') || 'null');
let isFirstLoad  = true;
let _suppressKanbanRender = false;
let _suppressTimer = null;

// ── Mapas ─────────────────────────────────────────────────────
const prioridadeClasse = {
  'Urgente':'badge-urgente','Necessário':'badge-necessario','Inviável':'badge-inviavel',
  'Terminado':'badge-terminado','Não urgente':'badge-naougente','Stand-by':'badge-standby'
};
const feedbackClasse = {
  'Em curso':'badge-emcurso','Concluído':'badge-concluido','Recusado':'badge-recusado',
  'Update':'badge-update','Em testes':'badge-emtestes','Stand-by':'badge-standby',
  'Em análise':'badge-emanalise','Sem efeito':'badge-semefeito','Sem sentido':'badge-semsentido'
};
const prioDotColors = {
  'Urgente':'#e53935','Necessário':'#f9a825','Não urgente':'#1565c0',
  'Stand-by':'#546e7a','Terminado':'#2e7d32','Inviável':'#c62828'
};
const prioRowClass = {
  'Urgente':'prio-urgente','Necessário':'prio-necessario','Inviável':'prio-inviavel',
  'Não urgente':'prio-naougente','Stand-by':'prio-standby','Terminado':'prio-terminado'
};
const prioOrder = { 'Urgente':0,'Necessário':1,'Não urgente':2,'Stand-by':3,'Terminado':4,'Inviável':5,'':99 };

const prioCardClass = {
  'Urgente':'cp-urgente','Necessário':'cp-necessario','Não urgente':'cp-naougente',
  'Stand-by':'cp-standby','Terminado':'cp-terminado','Inviável':'cp-inviavel'
};

const kanbanColDefs = {
  ativas: [
    { key: '',           label: 'Pendente',   color: '#90a4ae' },
    { key: 'Em análise', label: 'Em análise', color: '#fb8c00' },
    { key: 'Em curso',   label: 'Em curso',   color: '#00897b' },
    { key: 'Em testes',  label: 'Em testes',  color: '#8e24aa' },
    { key: 'Update',     label: 'Update',     color: '#1e88e5' },
    { key: 'Stand-by',   label: 'Stand-by',   color: '#546e7a' },
  ],
  recusadas: [
    { key: 'Recusado',    label: 'Recusado',    color: '#e53935' },
    { key: 'Sem efeito',  label: 'Sem efeito',  color: '#f4511e' },
    { key: 'Sem sentido', label: 'Sem sentido', color: '#d81b60' },
  ],
  concluidos: [
    { key: 'Concluído', label: 'Concluído', color: '#43a047' },
  ],
};

// ── Helpers de classificação ──────────────────────────────────
function isConcluido(d) { return d.prioridade === 'Terminado' && d.feedback === 'Concluído'; }
function isRecusado(d) {
  if (d.prioridade === 'Terminado' && ['Recusado','Sem efeito','Sem sentido'].includes(d.feedback)) return true;
  if (d.prioridade === 'Inviável'  && ['Recusado','Concluído','Sem efeito','Sem sentido'].includes(d.feedback)) return true;
  return false;
}
function isAtiva(d) { return !isConcluido(d) && !isRecusado(d); }

// ── Cache local ───────────────────────────────────────────────
const CACHE_KEY = 'sugestoes-cache';
try { const c = localStorage.getItem(CACHE_KEY); if (c) data = JSON.parse(c); } catch {}

// ── Firebase listener ─────────────────────────────────────────
onSnapshot(query(colRef, orderBy("id", "asc")), (snapshot) => {
  if (!isFirstLoad) {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const d = change.doc.data();
        toast(`📝 Nova sugestão #${d.id} — ${d.discord}`);
      }
    });
  }
  isFirstLoad = false;
  data = snapshot.docs.map(d => ({ _docId: d.id, ...d.data() }));
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  renderTable();
});

// ── Adicionar ─────────────────────────────────────────────────
async function addEntry() {
  const idRaw   = document.getElementById('f-id').value.trim();
  const discord = document.getElementById('f-discord').value.trim();
  const sug     = document.getElementById('f-sug').value.trim();
  const desc    = document.getElementById('f-desc').value.trim();
  if (!idRaw)   { toast('Preenche o ID.'); return; }
  if (!discord) { toast('Preenche o Discord.'); return; }
  if (!sug)     { toast('Preenche a Sugestão.'); return; }
  const id = isNaN(idRaw) ? idRaw : Number(idRaw);
  if (data.some(d => String(d.id) === String(id))) { toast(`⚠️ ID ${id} já existe!`); return; }
  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-PT') + ' ' + now.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
  await addDoc(colRef, { id, discord, sugestao: sug, descricao: desc, prioridade:'', feedback:'', comentario:'', data: dataStr });
  ['f-id','f-discord','f-sug','f-desc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('f-id').focus();
  toast('Sugestão adicionada!');
}

// ── Atualizar campo ───────────────────────────────────────────
async function updateField(docId, field, value, el) {
  const td = el ? el.closest('td') : null;
  if (td) td.classList.add('td-saving');
  await updateDoc(doc(db, "sugestoes", docId), { [field]: value });
  if (td) {
    td.classList.remove('td-saving');
    td.classList.add('td-saved');
    setTimeout(() => td.classList.remove('td-saved'), 1200);
  }
}

// ── Eliminar ──────────────────────────────────────────────────
function deleteEntry(docId, btnEl) {
  if (btnEl.dataset.confirming) {
    confirmDelete(docId);
    return;
  }
  // reset any other pending confirmations
  document.querySelectorAll('.btn-del[data-confirming]').forEach(b => _resetDelBtn(b));
  btnEl.dataset.confirming = '1';
  btnEl.title = 'Clica de novo para confirmar';
  btnEl.style.cssText = 'background:#8B1A1A;color:#fff;';
  btnEl._delTimer = setTimeout(() => _resetDelBtn(btnEl), 2000);
  document.addEventListener('click', function h(e) {
    if (e.target !== btnEl) { _resetDelBtn(btnEl); document.removeEventListener('click', h); }
  }, { capture: true, once: false });
}

function _resetDelBtn(btn) {
  clearTimeout(btn._delTimer);
  delete btn.dataset.confirming;
  btn.style.cssText = '';
  btn.title = 'Eliminar';
}

async function confirmDelete(docId) {
  await deleteDoc(doc(db, "sugestoes", docId));
  toast('Removido.');
}

// ── Limpar tudo ───────────────────────────────────────────────
function clearAll() {
  if (!data.length) return;
  document.getElementById('modal1-overlay').style.display = 'flex';
}
window.showModal2 = () => {
  document.getElementById('modal1-overlay').style.display = 'none';
  document.getElementById('modal2-overlay').style.display = 'flex';
};
window.showModal3 = () => {
  document.getElementById('modal2-overlay').style.display = 'none';
  document.getElementById('emergency-overlay').style.display = 'flex';
};
window.cancelEmergency = () => document.getElementById('emergency-overlay').style.display = 'none';
window.confirmEmergency = async () => {
  document.getElementById('emergency-overlay').style.display = 'none';
  await Promise.all(data.map(d => deleteDoc(doc(db, "sugestoes", d._docId))));
  localStorage.removeItem(CACHE_KEY);
  toast('Tabela limpa.');
};

// ── Ordenação ─────────────────────────────────────────────────
function sortBy(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  renderTable();
}

// ── Tabs ──────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  localStorage.setItem('active-tab', tab);
  activeFilters = { prioridade: [], feedback: [] };
  window.scrollTo({ top: 0, behavior: 'smooth' });
  _triggerViewFade();
  renderTable();
}

function _triggerViewFade() {
  const ids = ['table-container','cards-container','kanban-container'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') { el.classList.remove('view-fade'); void el.offsetWidth; el.classList.add('view-fade'); }
  });
}

// ── Filtros ───────────────────────────────────────────────────
function setFilter(type, value) {
  const arr = activeFilters[type];
  const idx = arr.indexOf(value);
  if (idx === -1) arr.push(value); else arr.splice(idx, 1);
  renderTable();
}

function clearSearch() {
  document.getElementById('search').value = '';
  document.getElementById('search-clear').classList.remove('visible');
  renderTable();
}

function clearFilters() {
  activeFilters = { prioridade: [], feedback: [] };
  renderTable();
}

// ── Dados filtrados ───────────────────────────────────────────
function getFilteredData() {
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  let f = data.filter(d =>
    !search ||
    String(d.id).includes(search) ||
    (d.discord || '').toLowerCase().includes(search) ||
    (d.sugestao || '').toLowerCase().includes(search) ||
    (d.descricao || '').toLowerCase().includes(search) ||
    (d.prioridade || '').toLowerCase().includes(search) ||
    (d.feedback || '').toLowerCase().includes(search) ||
    (d.comentario || '').toLowerCase().includes(search)
  );

  if (currentTab === 'ativas')    f = f.filter(isAtiva);
  else if (currentTab === 'recusadas')  f = f.filter(isRecusado);
  else if (currentTab === 'concluidos') f = f.filter(isConcluido);

  if (activeFilters.prioridade.length) f = f.filter(d => activeFilters.prioridade.includes(d.prioridade));
  if (activeFilters.feedback.length)   f = f.filter(d => activeFilters.feedback.includes(d.feedback));

  return f;
}

// ── HTML helpers ──────────────────────────────────────────────
function relativeDate(dataStr) {
  if (!dataStr) return '—';
  const [datePart, timePart] = dataStr.split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [h, min] = (timePart || '00:00').split(':').map(Number);
  const date = new Date(y, m - 1, d, h, min);
  const now  = new Date();
  const diffMs   = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)   return 'agora mesmo';
  if (diffMins < 60)  return `há ${diffMins} min`;
  if (diffHrs  < 24)  return `há ${diffHrs}h`;
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7)   return `há ${diffDays} dias`;
  if (diffDays < 30)  return `há ${Math.floor(diffDays/7)} sem.`;
  if (diffDays < 365) return `há ${Math.floor(diffDays/30)} meses`;
  return `há ${Math.floor(diffDays/365)} ano${Math.floor(diffDays/365)>1?'s':''}`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function prioBadgeDot(prioridade) {
  const color = prioDotColors[prioridade];
  return color ? `<span class="prio-dot" style="background:${color}" title="${prioridade}"></span>` : '';
}

function avatarHtml(name) {
  const colors = ['#1B2F6E','#2e7d4f','#8B1A1A','#00897b','#8e24aa','#c0392b','#1565c0','#546e7a'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return `<span class="avatar" style="background:${colors[Math.abs(h)]}">${name.charAt(0).toUpperCase()}</span>`;
}

function cellWithExpand(text) {
  if (!text) return '<span style="color:var(--text-dim)">—</span>';
  return `<div class="cell-text">${esc(text)}</div>
    <span class="cell-expand-btn" onclick="var t=this.previousElementSibling;t.classList.toggle('expanded');this.textContent=t.classList.contains('expanded')?'▲ Ver menos':'▼ Ver mais'">▼ Ver mais</span>`;
}

function customSelectHtml(docId, field, value, options, classeMap) {
  const triggerInner = value
    ? `<span class="badge ${classeMap[value] || 'badge-default'}">${esc(value)}</span>`
    : `<span class="cs-placeholder">—</span>`;
  const optsHtml = [
    `<div class="cs-option" onclick="selectOption(this,'${docId}','${field}','')"><span class="cs-empty">—</span></div>`,
    ...options.map(o => `<div class="cs-option${value===o?' cs-selected':''}" onclick="selectOption(this,'${docId}','${field}','${o}')"><span class="badge ${classeMap[o]||'badge-default'}">${esc(o)}</span></div>`)
  ].join('');
  return `<div class="custom-select" data-field="${field}">
    <div class="cs-trigger" onclick="toggleSelect(this)">${triggerInner}<span class="cs-arrow">▾</span></div>
    <div class="cs-dropdown">${optsHtml}</div>
  </div>`;
}

function kanbanCustomSelectHtml(docId, field, value, options, classeMap) {
  const triggerInner = value
    ? `<span class="badge ${classeMap[value] || 'badge-default'}">${esc(value)}</span>`
    : `<span class="cs-placeholder">—</span>`;
  const optsHtml = [
    `<div class="cs-option" onclick="kanbanSelectOption(this,'${docId}','${field}','')"><span class="cs-empty">—</span></div>`,
    ...options.map(o => `<div class="cs-option${value===o?' cs-selected':''}" onclick="kanbanSelectOption(this,'${docId}','${field}','${o}')"><span class="badge ${classeMap[o]||'badge-default'}">${esc(o)}</span></div>`)
  ].join('');
  return `<div class="custom-select" data-field="${field}">
    <div class="cs-trigger" onclick="toggleSelect(this)">${triggerInner}<span class="cs-arrow">▾</span></div>
    <div class="cs-dropdown">${optsHtml}</div>
  </div>`;
}

function kanbanSelectOption(optEl, docId, field, value) {
  const cs = optEl.closest('.custom-select');
  cs.classList.remove('cs-open');
  const classeMap = field === 'prioridade' ? prioridadeClasse : feedbackClasse;
  cs.querySelector('.cs-trigger').innerHTML = value
    ? `<span class="badge ${classeMap[value]||'badge-default'}">${esc(value)}</span><span class="cs-arrow">▾</span>`
    : `<span class="cs-placeholder">—</span><span class="cs-arrow">▾</span>`;

  const card = cs.closest('.kanban-card');

  if (field === 'feedback' && card) {
    const currentCol = card.closest('.kanban-col');
    card.dataset.feedback = value;
    const targetCol = document.querySelector(`.kanban-col[data-feedback="${value}"]`);
    if (targetCol && targetCol !== currentCol) {
      const targetCards = targetCol.querySelector('.kanban-cards');
      targetCards.querySelector('.kanban-empty')?.remove();
      targetCards.prepend(card);
      _updateKanbanColStats();
    }
  }

  if (field === 'prioridade' && card) {
    const prioColor = prioDotColors[value] || '';
    card.style.borderLeftColor = prioColor;
  }

  _suppressKanbanRender = true;
  clearTimeout(_suppressTimer);
  _suppressTimer = setTimeout(() => { _suppressKanbanRender = false; }, 3000);
  updateField(docId, field, value);
}

function _updateKanbanColStats() {
  document.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    const countEl = col.querySelector('.kanban-col-count');
    if (countEl) countEl.textContent = count;
    const cardsDiv = col.querySelector('.kanban-cards');
    if (count === 0 && cardsDiv && !cardsDiv.querySelector('.kanban-empty')) {
      cardsDiv.innerHTML = '<div class="kanban-empty">— vazio —</div>';
    }
    col.classList.toggle('kanban-col-empty', count === 0);
  });
}

// ── "Ver mais" só quando necessário ──────────────────────────
function fixExpandBtns() {
  document.querySelectorAll('.cell-text, .comment-text').forEach(el => {
    const overflows = el.scrollHeight > el.clientHeight + 4;
    const btn = el.nextElementSibling;
    if (btn && btn.classList.contains('cell-expand-btn')) btn.style.display = overflows ? '' : 'none';
    el.classList.toggle('no-overflow', !overflows);
  });
}

// ── Render tabela ─────────────────────────────────────────────
function renderTable() {
  const searchVal = document.getElementById('search')?.value || '';
  const clearBtn  = document.getElementById('search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', searchVal.length > 0);

  const filtered = getFilteredData();

  // Contadores tabs com pulse
  const searchLow = searchVal.toLowerCase();
  const base = data.filter(d =>
    !searchLow ||
    String(d.id).includes(searchLow) || (d.discord||'').toLowerCase().includes(searchLow) ||
    (d.sugestao||'').toLowerCase().includes(searchLow) || (d.descricao||'').toLowerCase().includes(searchLow) ||
    (d.prioridade||'').toLowerCase().includes(searchLow) || (d.feedback||'').toLowerCase().includes(searchLow) ||
    (d.comentario||'').toLowerCase().includes(searchLow)
  );
  const counts = { ativas: base.filter(isAtiva).length, recusadas: base.filter(isRecusado).length, concluidos: base.filter(isConcluido).length };
  ['ativas','recusadas','concluidos'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (!el) return;
    const lbl = t === 'ativas' ? 'Ativas' : t === 'recusadas' ? 'Recusadas' : 'Concluídos';
    const oldCount = el.querySelector('.tab-count')?.textContent;
    el.innerHTML = `${lbl} <span class="tab-count">${counts[t]}</span>`;
    el.classList.toggle('active', t === currentTab);
    if (oldCount !== undefined && oldCount !== String(counts[t])) {
      const tc = el.querySelector('.tab-count');
      if (tc) { tc.classList.remove('pulse'); void tc.offsetWidth; tc.classList.add('pulse'); }
    }
  });

  // Chips
  const hasFilters = activeFilters.prioridade.length || activeFilters.feedback.length;
  document.querySelectorAll('.chip').forEach(chip =>
    chip.classList.toggle('chip-active', activeFilters[chip.dataset.filter]?.includes(chip.dataset.value))
  );
  const clearAllBtn = document.getElementById('chip-clear-all');
  if (clearAllBtn) clearAllBtn.style.display = hasFilters ? 'inline-block' : 'none';

  // Contador filtros
  let countEl = document.getElementById('filter-count-el');
  if (!countEl) {
    countEl = document.createElement('div');
    countEl.id = 'filter-count-el';
    countEl.className = 'filter-count-el';
    document.getElementById('status-msg')?.insertAdjacentElement('afterend', countEl);
  }
  countEl.innerHTML = (hasFilters || searchVal) && filtered.length !== data.length
    ? `A mostrar <strong>${filtered.length}</strong> de ${data.length} sugestões`
    : '';

  // Ordenação — IDs mistos (números e strings)
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (sortCol === 'id') {
      const na = isNaN(String(va)) ? null : Number(va);
      const nb = isNaN(String(vb)) ? null : Number(vb);
      if (na !== null && nb !== null) return sortAsc ? na - nb : nb - na;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }
    if (sortCol === 'prioridade') { va = prioOrder[va]??99; vb = prioOrder[vb]??99; return sortAsc ? va-vb : vb-va; }
    va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  ['id','discord','sugestao','descricao','prioridade','feedback','comentario','data'].forEach(c => {
    const th = document.getElementById('th-' + c);
    if (!th) return;
    th.classList.toggle('sorted', sortCol === c);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = sortCol === c ? (sortAsc ? '↑' : '↓') : '↕';
  });

  document.getElementById('total-badge').textContent = data.length + (data.length === 1 ? ' sugestão' : ' sugestões');

  const prioOpts = ['Urgente','Necessário','Inviável','Terminado','Não urgente','Stand-by'];
  const feedOpts = ['Em curso','Concluído','Recusado','Update','Em testes','Stand-by','Em análise','Sem efeito','Sem sentido'];

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    const hasSearch = searchVal || activeFilters.prioridade.length || activeFilters.feedback.length;
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-state-icon">${hasSearch ? '🔍' : '📭'}</div>
      <div class="empty-state-title">${hasSearch ? 'Sem resultados' : 'Sem sugestões'}</div>
      <div class="empty-state-sub">${hasSearch ? 'Tenta ajustar os filtros ou a pesquisa.' : 'Adiciona a primeira sugestão acima.'}</div>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(d => `
      <tr class="row-fade ${prioRowClass[d.prioridade] || ''}">
        <td class="td-id">#${esc(String(d.id))}</td>
        <td class="td-discord"><div class="discord-cell">${avatarHtml(d.discord)}<span title="${esc(d.discord)}">${esc(d.discord)}</span></div></td>
        <td class="td-sug">${prioBadgeDot(d.prioridade)}${esc(d.sugestao)}</td>
        <td class="td-desc">${cellWithExpand(d.descricao)}</td>
        <td>${customSelectHtml(d._docId,'prioridade',d.prioridade,prioOpts,prioridadeClasse)}</td>
        <td>${customSelectHtml(d._docId,'feedback',d.feedback,feedOpts,feedbackClasse)}</td>
        <td class="td-comment">
          <div class="comment-cell" data-docid="${d._docId}" data-value="${esc(d.comentario||'')}" onclick="startEditComment(this)">
            ${d.comentario ? `<span class="comment-text">${esc(d.comentario)}</span>` : '<span class="comment-placeholder">Adicionar...</span>'}
            <span class="comment-icon">✏</span>
          </div>
        </td>
        <td class="td-date" title="${d.data}">${relativeDate(d.data)}</td>
        <td class="td-actions"><button class="btn-del" onclick="deleteEntry('${d._docId}',this)" title="Eliminar">×</button></td>
      </tr>
    `).join('');
    setTimeout(fixExpandBtns, 0);
  }

  if (viewMode === 'cards')  renderCards(filtered);
  if (viewMode === 'kanban' && !_suppressKanbanRender) renderKanban(filtered);
}

// ── Comentário editável ───────────────────────────────────────
function startEditComment(cell) {
  const docId = cell.dataset.docid;
  const raw   = cell.dataset.value.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const td    = cell.parentElement;
  const ta    = document.createElement('textarea');
  ta.className   = 'comment-textarea';
  ta.value       = raw;
  ta.placeholder = 'Escreve um comentário...';
  td.innerHTML   = '';
  td.appendChild(ta);
  ta.focus();
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight, 36) + 'px';
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 36) + 'px'; });
  ta.addEventListener('blur', async () => {
    const newVal = ta.value.trim();
    if (newVal !== raw) await updateField(docId, 'comentario', newVal);
    else renderTable();
  });
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') ta.blur(); });
}

// ── Dropdown ──────────────────────────────────────────────────
function toggleSelect(trigger) {
  const cs     = trigger.parentElement;
  const isOpen = cs.classList.contains('cs-open');
  document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open'));
  if (!isOpen) {
    cs.classList.add('cs-open');
    const rect     = trigger.getBoundingClientRect();
    const dropdown = cs.querySelector('.cs-dropdown');
    dropdown.style.minWidth   = Math.max(rect.width, 150) + 'px';
    dropdown.style.left       = rect.left + 'px';
    dropdown.style.visibility = 'hidden';
    dropdown.style.top        = (rect.bottom + 4) + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const dRect = dropdown.getBoundingClientRect();
      dropdown.style.top = dRect.bottom > window.innerHeight - 8
        ? (rect.top - dRect.height - 4) + 'px'
        : (rect.bottom + 4) + 'px';
      dropdown.style.visibility = '';
    }));
  }
}

function selectOption(optEl, docId, field, value) {
  const cs       = optEl.closest('.custom-select');
  cs.classList.remove('cs-open');
  const classeMap = field === 'prioridade' ? prioridadeClasse : feedbackClasse;
  cs.querySelector('.cs-trigger').innerHTML = value
    ? `<span class="badge ${classeMap[value]||'badge-default'}">${esc(value)}</span><span class="cs-arrow">▾</span>`
    : `<span class="cs-placeholder">—</span><span class="cs-arrow">▾</span>`;
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.toggle('cs-selected', o.dataset.value === value));
  updateField(docId, field, value);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.custom-select'))
    document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open'));
});

// ── Cards ─────────────────────────────────────────────────────
function applyCardOrder(filtered) {
  if (!customCardOrder) return filtered;
  const map = {};
  customCardOrder.forEach((id, i) => map[id] = i);
  return [...filtered].sort((a, b) => (map[a._docId] ?? 9999) - (map[b._docId] ?? 9999));
}

function saveCardOrder() {
  const ids = [...document.querySelectorAll('#cards-container .suggestion-card')].map(el => el.dataset.docid);
  customCardOrder = ids;
  localStorage.setItem('card-order', JSON.stringify(ids));
}

function resetCardOrder() {
  customCardOrder = null;
  localStorage.removeItem('card-order');
  updateReporBtn();
  renderTable();
  toast('Ordem reposta.');
}

function updateReporBtn() {
  const btn = document.getElementById('btn-repor-ordem');
  if (btn) btn.style.display = customCardOrder ? '' : 'none';
}

function renderCards(filtered) {
  const ordered  = applyCardOrder(filtered);
  const prioOpts = ['Urgente','Necessário','Inviável','Terminado','Não urgente','Stand-by'];
  const feedOpts = ['Em curso','Concluído','Recusado','Update','Em testes','Stand-by','Em análise','Sem efeito','Sem sentido'];
  const container = document.getElementById('cards-container');
  if (!ordered.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">Sem sugestões</div>
      <div class="empty-state-sub">Não há sugestões que correspondam aos filtros.</div>
    </div>`;
    return;
  }
  container.innerHTML = ordered.map(d => `
    <div class="suggestion-card row-fade ${prioCardClass[d.prioridade]||''}" draggable="true" data-docid="${d._docId}">
      <div class="card-header">
        <div class="card-meta">
          <span class="card-id">#${esc(String(d.id))}</span>
          <div class="discord-cell">${avatarHtml(d.discord)}<span class="card-discord">${esc(d.discord)}</span></div>
        </div>
        <button class="btn-del" onclick="deleteEntry('${d._docId}',this)" title="Eliminar">×</button>
      </div>
      <div class="card-title">${prioBadgeDot(d.prioridade)}${esc(d.sugestao)}</div>
      <div class="card-selects">
        <div class="card-dropdown-wrap">
          <span class="card-dropdown-label">Prioridade</span>
          ${customSelectHtml(d._docId,'prioridade',d.prioridade,prioOpts,prioridadeClasse)}
        </div>
        <div class="card-dropdown-wrap">
          <span class="card-dropdown-label">Estado</span>
          ${customSelectHtml(d._docId,'feedback',d.feedback,feedOpts,feedbackClasse)}
        </div>
      </div>
      <div class="card-desc">
        <span class="card-section-label">Descrição</span>
        ${d.descricao ? cellWithExpand(d.descricao) : '<span class="card-empty-field">Sem descrição</span>'}
      </div>
      <div class="card-comment">
        <span class="card-section-label">Comentário</span>
        <div class="comment-cell" data-docid="${d._docId}" data-value="${esc(d.comentario||'')}" onclick="startEditComment(this)">
          ${d.comentario ? `<span class="comment-text">${esc(d.comentario)}</span>` : '<span class="comment-placeholder">Adicionar comentário...</span>'}
          <span class="comment-icon">✏</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-date" title="${d.data}">${relativeDate(d.data)}</span>
        <div class="card-drag-handle" title="Arrastar para reordenar">⠿</div>
      </div>
    </div>
  `).join('');
  setTimeout(fixExpandBtns, 0);
  initDragAndDrop();
}

function initDragAndDrop() {
  const container = document.getElementById('cards-container');
  let dragSrc     = null;
  container.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('dragstart', e => { dragSrc = card; card.classList.add('card-dragging'); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend',   () => { card.classList.remove('card-dragging'); container.querySelectorAll('.card-drag-over').forEach(el => el.classList.remove('card-drag-over')); saveCardOrder(); updateReporBtn(); });
    card.addEventListener('dragover',  e => { e.preventDefault(); if (card === dragSrc) return; container.querySelectorAll('.card-drag-over').forEach(el => el.classList.remove('card-drag-over')); card.classList.add('card-drag-over'); });
    card.addEventListener('drop',      e => { e.preventDefault(); if (card === dragSrc) return; const cards = [...container.querySelectorAll('.suggestion-card')]; const srcIdx = cards.indexOf(dragSrc); srcIdx < cards.indexOf(card) ? card.after(dragSrc) : card.before(dragSrc); card.classList.remove('card-drag-over'); });
  });
}

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('view-mode', mode);
  document.querySelectorAll('.btn-view-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('table-container').style.display  = mode === 'table'  ? '' : 'none';
  document.getElementById('cards-container').style.display  = mode === 'cards'  ? '' : 'none';
  document.getElementById('kanban-container').style.display = mode === 'kanban' ? '' : 'none';
  document.getElementById('cards-sort').style.display       = mode === 'cards'  ? 'flex' : 'none';
  _triggerViewFade();
  renderTable();
}

function toggleView() { setViewMode(viewMode === 'table' ? 'cards' : 'table'); }

// ── Kanban ────────────────────────────────────────────────────
function renderKanban(filtered) {
  const container = document.getElementById('kanban-container');
  const cols = kanbanColDefs[currentTab] || kanbanColDefs.ativas;

  container.innerHTML = cols.map(col => {
    const cards = filtered.filter(d => (d.feedback || '') === col.key);
    const isEmpty = cards.length === 0;
    return `
      <div class="kanban-col${isEmpty ? ' kanban-col-empty' : ''}" data-feedback="${col.key}" style="border-top:3px solid ${col.color}">
        <div class="kanban-col-header" style="background:${col.color}12">
          <span class="kanban-col-title" style="color:${col.color}">${col.label}</span>
          <span class="kanban-col-count" style="background:${col.color}">${cards.length}</span>
        </div>
        <div class="kanban-cards">
          ${cards.length ? cards.map(d => kanbanCardHtml(d)).join('') : '<div class="kanban-empty">— vazio —</div>'}
        </div>
      </div>`;
  }).join('');

  initKanbanDnD();
}

function kanbanCardHtml(d) {
  const prioColor = prioDotColors[d.prioridade] || '';
  const prioOpts = ['Urgente','Necessário','Inviável','Terminado','Não urgente','Stand-by'];
  const feedOpts = ['Em curso','Concluído','Recusado','Update','Em testes','Stand-by','Em análise','Sem efeito','Sem sentido'];
  return `
    <div class="kanban-card" draggable="true" data-docid="${d._docId}" data-feedback="${d.feedback||''}"
         style="${prioColor ? `border-left-color:${prioColor}` : ''}">
      <div class="kanban-card-top">
        <div class="kanban-card-meta">
          <span class="card-id">#${esc(String(d.id))}</span>
          ${avatarHtml(d.discord)}
          <span class="kanban-discord-name">${esc(d.discord)}</span>
        </div>
        <button class="btn-del" onclick="deleteEntry('${d._docId}',this)" title="Eliminar">×</button>
      </div>
      <div class="kanban-card-title">${esc(d.sugestao)}</div>
      <div class="kanban-card-selects">
        ${kanbanCustomSelectHtml(d._docId,'prioridade',d.prioridade,prioOpts,prioridadeClasse)}
        ${kanbanCustomSelectHtml(d._docId,'feedback',d.feedback,feedOpts,feedbackClasse)}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-date">${relativeDate(d.data)}</span>
      </div>
    </div>`;
}

function initKanbanDnD() {
  let dragDocId = null;
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (e.target.closest('.custom-select, .btn-del')) { e.preventDefault(); return; }
      dragDocId = card.dataset.docid;
      card.classList.add('card-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('card-dragging');
      document.querySelectorAll('.kanban-drag-over').forEach(el => el.classList.remove('kanban-drag-over'));
    });
  });

  document.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      document.querySelectorAll('.kanban-drag-over').forEach(el => el.classList.remove('kanban-drag-over'));
      col.classList.add('kanban-drag-over');
    });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('kanban-drag-over'); });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('kanban-drag-over');
      if (!dragDocId) return;
      const newFeedback = col.dataset.feedback;
      const card = document.querySelector(`.kanban-card[data-docid="${dragDocId}"]`);
      if (!card || card.dataset.feedback === newFeedback) return;

      // Optimistic: move card and update dropdown immediately
      card.dataset.feedback = newFeedback;
      const targetCards = col.querySelector('.kanban-cards');
      targetCards.querySelector('.kanban-empty')?.remove();
      targetCards.prepend(card);
      const feedSel = card.querySelector('.custom-select[data-field="feedback"]');
      if (feedSel) {
        const badge = feedbackClasse[newFeedback] || 'badge-default';
        feedSel.querySelector('.cs-trigger').innerHTML = newFeedback
          ? `<span class="badge ${badge}">${esc(newFeedback)}</span><span class="cs-arrow">▾</span>`
          : `<span class="cs-placeholder">—</span><span class="cs-arrow">▾</span>`;
      }
      _updateKanbanColStats();
      _suppressKanbanRender = true;
      clearTimeout(_suppressTimer);
      _suppressTimer = setTimeout(() => { _suppressKanbanRender = false; }, 3000);

      await updateField(dragDocId, 'feedback', newFeedback);
      toast(`Estado → ${newFeedback || 'Pendente'}`);
    });
  });
}

function cardsSortBy(col) {
  customCardOrder = null;
  localStorage.removeItem('card-order');
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  document.querySelectorAll('.cards-sort-btn[data-col]').forEach(b => b.classList.toggle('active', b.dataset.col === col));
  const dirBtn = document.getElementById('cards-sort-dir');
  if (dirBtn) dirBtn.innerHTML = sortAsc
    ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,4 10,8"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,4 6,8 10,4"/></svg>`;
  renderTable();
}

function cardsSortDirToggle() {
  sortAsc = !sortAsc;
  const dirBtn = document.getElementById('cards-sort-dir');
  if (dirBtn) dirBtn.innerHTML = sortAsc
    ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,4 10,8"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,4 6,8 10,4"/></svg>`;
  renderTable();
}

function toggleCompact() {
  compactCards = !compactCards;
  localStorage.setItem('compact-cards', compactCards);
  document.getElementById('cards-container')?.classList.toggle('compact', compactCards);
  const btn = document.getElementById('btn-compact');
  if (btn) { btn.textContent = compactCards ? '⊞ Normal' : '⊟ Compacto'; btn.classList.toggle('active', compactCards); }
}

// ── Excel ─────────────────────────────────────────────────────
function exportExcel() {
  const filtered = getFilteredData();
  if (!filtered.length) { toast('Sem dados para exportar.'); return; }
  const tabLabel = currentTab === 'ativas' ? 'Ativas' : currentTab === 'recusadas' ? 'Recusadas' : 'Concluídos';
  const rows = [['ID','Discord','Sugestão','Descrição','Prioridade','Feedback Dev','Comentários','Data']];
  filtered.forEach(d => rows.push([d.id, d.discord, d.sugestao, d.descricao||'', d.prioridade||'', d.feedback||'', d.comentario||'', d.data]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:6},{wch:22},{wch:30},{wch:40},{wch:14},{wch:14},{wch:30},{wch:16}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tabLabel);
  XLSX.writeFile(wb, `sugestoes-${tabLabel.toLowerCase()}.xlsx`);
  toast(`Excel exportado (${tabLabel})!`);
}

// ── Tema ──────────────────────────────────────────────────────
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('btn-theme').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ── Toast / status ────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  const isError = msg.startsWith('⚠️') || msg.startsWith('Preenche');
  const iconSvg = isError
    ? `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M8 1.5L1 14.5h14L8 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const cleanMsg = msg.replace(/^[⚠️📝]\s*/, '');
  el.innerHTML = iconSvg + `<span>${cleanMsg}</span>`;
  el.style.borderLeftColor = isError ? 'var(--red)' : 'var(--accent)';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Tema guardado ─────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  setViewMode(viewMode);
  updateReporBtn();
  if (compactCards) {
    document.getElementById('cards-container')?.classList.add('compact');
    const btnC = document.getElementById('btn-compact');
    if (btnC) { btnC.textContent = '⊞ Normal'; btnC.classList.add('active'); }
  }
});

// ── Sticky bar shadow ─────────────────────────────────────────
const _stickyBar = document.querySelector('.sticky-bar');
if (_stickyBar) {
  const _stickyObs = new IntersectionObserver(([e]) => {
    _stickyBar.classList.toggle('is-stuck', e.intersectionRatio < 1);
  }, { threshold: [1], rootMargin: '-1px 0px 0px 0px' });
  _stickyObs.observe(_stickyBar);
}

// ── Scroll to top ────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('scroll-top')?.classList.toggle('visible', window.scrollY > 300);
}, { passive: true });

// ── Teclado ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);

  if (inInput) {
    if (e.key === 'Enter' && ['f-id','f-discord','f-sug','f-desc'].includes(e.target.id)) addEntry();
    if (e.key === 'Escape') { document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open')); e.target.blur(); }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); document.getElementById('search')?.focus(); return; }
  if (e.key === 'n' || e.key === 'N') { document.getElementById('f-id')?.focus(); return; }
  if (e.key === '1') { setViewMode('table'); return; }
  if (e.key === '2') { setViewMode('cards'); return; }
  if (e.key === '3') { setViewMode('kanban'); return; }
  if (e.key === '?') { toggleShortcuts(); return; }
  if (e.key === 'Escape') {
    document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open'));
    document.getElementById('shortcuts-overlay')?.remove();
  }
});

let shortcutsVisible = false;
function toggleShortcuts(btnEl) {
  const existing = document.getElementById('shortcuts-overlay');
  if (existing) { existing.remove(); return; }
  const el = document.createElement('div');
  el.id = 'shortcuts-overlay';
  el.className = 'shortcuts-overlay';
  el.innerHTML = `
    <h4>Atalhos de teclado</h4>
    <div class="shortcut-row"><span>Pesquisar</span><span class="shortcut-key">Ctrl+F</span></div>
    <div class="shortcut-row"><span>Nova sugestão</span><span class="shortcut-key">N</span></div>
    <div class="shortcut-row"><span>Vista Tabela</span><span class="shortcut-key">1</span></div>
    <div class="shortcut-row"><span>Vista Cards</span><span class="shortcut-key">2</span></div>
    <div class="shortcut-row"><span>Vista Kanban</span><span class="shortcut-key">3</span></div>
    <div class="shortcut-row"><span>Atalhos</span><span class="shortcut-key">?</span></div>
  `;
  el.style.position = 'fixed';
  el.style.bottom = 'auto';
  el.style.left = 'auto';
  document.body.appendChild(el);
  if (btnEl) {
    const rect = btnEl.getBoundingClientRect();
    const elW = el.offsetWidth || 200;
    el.style.top  = (rect.bottom + 8) + 'px';
    el.style.left = Math.max(8, rect.right - elW) + 'px';
    el.style.right = 'auto';
  } else {
    el.style.top = '80px'; el.style.right = '24px';
  }
  setTimeout(() => document.addEventListener('click', e => { if (!el.contains(e.target)) el.remove(); }, { once: true }), 100);
}

// ── Exports ───────────────────────────────────────────────────
window.addEntry        = addEntry;
window.deleteEntry     = deleteEntry;
window.confirmDelete   = confirmDelete;
window.updateField     = updateField;
window.clearAll        = clearAll;
window.sortBy          = sortBy;
window.exportExcel     = exportExcel;
window.toggleTheme     = toggleTheme;
window.renderTable     = renderTable;
window.setTab          = setTab;
window.setFilter       = setFilter;
window.clearSearch     = clearSearch;
window.clearFilters    = clearFilters;
window.startEditComment = startEditComment;
window.toggleSelect    = toggleSelect;
window.selectOption    = selectOption;
window.toggleView      = toggleView;
window.setViewMode     = setViewMode;
window.toggleShortcuts = toggleShortcuts;
window.toggleCompact      = toggleCompact;
window.cardsSortBy     = cardsSortBy;
window.cardsSortDirToggle = cardsSortDirToggle;
window.resetCardOrder  = resetCardOrder;
window.updateReporBtn  = updateReporBtn;
