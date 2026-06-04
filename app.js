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
const db = getFirestore(app);
const colRef = collection(db, "sugestoes");

let data = [];
let sortCol = 'id';
let sortAsc = false;
let currentTab = 'ativas';
let activeFilters = { prioridade: [], feedback: [] };

const prioridadeClasse = {
  'Urgente': 'badge-urgente', 'Necessário': 'badge-necessario', 'Inviável': 'badge-inviavel',
  'Terminado': 'badge-terminado', 'Não urgente': 'badge-naougente', 'Stand-by': 'badge-standby'
};

const feedbackClasse = {
  'Em curso': 'badge-emcurso', 'Concluído': 'badge-concluido', 'Recusado': 'badge-recusado',
  'Update': 'badge-update', 'Em testes': 'badge-emtestes', 'Stand-by': 'badge-standby',
  'Em análise': 'badge-emanalise', 'Sem efeito': 'badge-semefeito', 'Sem sentido': 'badge-semsentido'
};

const prioOrder = { 'Urgente': 0, 'Necessário': 1, 'Não urgente': 2, 'Stand-by': 3, 'Terminado': 4, 'Inviável': 5, '': 99 };

onSnapshot(query(colRef, orderBy("id", "asc")), (snapshot) => {
  data = snapshot.docs.map(d => ({ _docId: d.id, ...d.data() }));
  renderTable();
  setStatus("");
});

async function addEntry() {
  const discord = document.getElementById('f-discord').value.trim();
  const sug = document.getElementById('f-sug').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  if (!discord || !sug) { toast('Preenche o Discord e a Sugestão.'); return; }

  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-PT') + ' ' + now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const nextId = data.length ? Math.max(...data.map(d => d.id)) + 1 : 1;

  setStatus("A guardar...");
  await addDoc(colRef, { id: nextId, discord, sugestao: sug, descricao: desc, prioridade: '', feedback: '', comentario: '', data: dataStr });

  document.getElementById('f-discord').value = '';
  document.getElementById('f-sug').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-discord').focus();
  toast('Sugestão adicionada!');
}

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

function deleteEntry(docId, btnEl) {
  const td = btnEl.closest('td');
  td.innerHTML = `
    <div class="confirm-del">
      <span>Apagar?</span>
      <button class="confirm-yes" onclick="confirmDelete('${docId}')">Sim</button>
      <button class="confirm-no" onclick="renderTable()">Não</button>
    </div>`;
}

async function confirmDelete(docId) {
  await deleteDoc(doc(db, "sugestoes", docId));
  toast('Removido.');
}

async function clearAll() {
  if (!data.length) return;
  if (!confirm('Tens a certeza que queres apagar tudo?')) return;
  setStatus("A apagar...");
  await Promise.all(data.map(d => deleteDoc(doc(db, "sugestoes", d._docId))));
  toast('Tabela limpa.');
}

function sortBy(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  renderTable();
}

function setTab(tab) {
  currentTab = tab;
  activeFilters = { prioridade: [], feedback: [] };
  renderTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

function setFilter(type, value) {
  const arr = activeFilters[type];
  const idx = arr.indexOf(value);
  if (idx === -1) arr.push(value);
  else arr.splice(idx, 1);
  renderTable();
}

function customSelectHtml(docId, field, value, options, classeMap) {
  const triggerInner = value
    ? `<span class="badge ${classeMap[value] || 'badge-default'}">${esc(value)}</span>`
    : `<span class="cs-placeholder">—</span>`;

  const optionsHtml = [
    `<div class="cs-option" onclick="selectOption(this,'${docId}','${field}','')"><span class="cs-empty">—</span></div>`,
    ...options.map(o => {
      const cls = classeMap[o] || 'badge-default';
      return `<div class="cs-option${value === o ? ' cs-selected' : ''}" onclick="selectOption(this,'${docId}','${field}','${o}')"><span class="badge ${cls}">${esc(o)}</span></div>`;
    })
  ].join('');

  return `<div class="custom-select" data-field="${field}">
    <div class="cs-trigger" onclick="toggleSelect(this)">${triggerInner}<span class="cs-arrow">▾</span></div>
    <div class="cs-dropdown">${optionsHtml}</div>
  </div>`;
}

function toggleSelect(trigger) {
  const cs = trigger.parentElement;
  const isOpen = cs.classList.contains('cs-open');
  document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open'));
  if (!isOpen) {
    cs.classList.add('cs-open');
    const rect = trigger.getBoundingClientRect();
    const dropdown = cs.querySelector('.cs-dropdown');
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.minWidth = Math.max(rect.width, 150) + 'px';
  }
}

function selectOption(optEl, docId, field, value) {
  const cs = optEl.closest('.custom-select');
  cs.classList.remove('cs-open');
  const classeMap = field === 'prioridade' ? prioridadeClasse : feedbackClasse;
  const trigger = cs.querySelector('.cs-trigger');
  trigger.innerHTML = value
    ? `<span class="badge ${classeMap[value] || 'badge-default'}">${esc(value)}</span><span class="cs-arrow">▾</span>`
    : `<span class="cs-placeholder">—</span><span class="cs-arrow">▾</span>`;
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.toggle('cs-selected', o.dataset.value === value));
  updateField(docId, field, value);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.custom-select'))
    document.querySelectorAll('.custom-select.cs-open').forEach(el => el.classList.remove('cs-open'));
});

function avatarHtml(name) {
  const colors = ['#1B2F6E','#2e7d4f','#8B1A1A','#00897b','#8e24aa','#c0392b','#1565c0','#546e7a'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return `<span class="avatar" style="background:${colors[Math.abs(hash)]}">${name.charAt(0).toUpperCase()}</span>`;
}

function renderTable() {
  const searchVal = document.getElementById('search')?.value || '';
  const search = searchVal.toLowerCase();
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', searchVal.length > 0);
  let filtered = data.filter(d =>
    !search ||
    String(d.id).includes(search) ||
    d.discord.toLowerCase().includes(search) ||
    d.sugestao.toLowerCase().includes(search) ||
    (d.descricao || '').toLowerCase().includes(search) ||
    (d.prioridade || '').toLowerCase().includes(search) ||
    (d.feedback || '').toLowerCase().includes(search)
  );

  // contadores dos tabs
  const counts = {
    ativas: filtered.filter(d => d.feedback !== 'Recusado' && d.feedback !== 'Concluído').length,
    recusadas: filtered.filter(d => d.feedback === 'Recusado').length,
    concluidos: filtered.filter(d => d.feedback === 'Concluído').length,
  };
  ['ativas','recusadas','concluidos'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (!el) return;
    const label = t === 'ativas' ? 'Ativas' : t === 'recusadas' ? 'Recusadas' : 'Concluídos';
    el.innerHTML = `${label} <span class="tab-count">${counts[t]}</span>`;
    el.classList.toggle('active', t === currentTab);
  });

  // filtro por tab
  if (currentTab === 'ativas') filtered = filtered.filter(d => d.feedback !== 'Recusado' && d.feedback !== 'Concluído');
  else if (currentTab === 'recusadas') filtered = filtered.filter(d => d.feedback === 'Recusado');
  else if (currentTab === 'concluidos') filtered = filtered.filter(d => d.feedback === 'Concluído');

  // filtros rápidos
  if (activeFilters.prioridade.length) filtered = filtered.filter(d => activeFilters.prioridade.includes(d.prioridade));
  if (activeFilters.feedback.length) filtered = filtered.filter(d => activeFilters.feedback.includes(d.feedback));

  // estado activo dos chips e botão limpar filtros
  const hasFilters = activeFilters.prioridade.length || activeFilters.feedback.length;
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('chip-active', activeFilters[chip.dataset.filter].includes(chip.dataset.value));
  });
  const clearAllBtn = document.getElementById('chip-clear-all');
  if (clearAllBtn) clearAllBtn.style.display = hasFilters ? 'inline-block' : 'none';

  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (sortCol === 'id') return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    if (sortCol === 'prioridade') {
      va = prioOrder[va] ?? 99; vb = prioOrder[vb] ?? 99;
      return sortAsc ? va - vb : vb - va;
    }
    va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  ['id','discord','sugestao','descricao','prioridade','feedback','comentario','data'].forEach(c => {
    const th = document.getElementById('th-' + c);
    if (!th) return;
    th.classList.toggle('sorted', sortCol === c);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = sortCol === c ? (sortAsc ? '↑' : '↓') : '↕';
  });

  const prioOpts = ['Urgente','Necessário','Inviável','Terminado','Não urgente','Stand-by'];
  const feedOpts = ['Em curso','Concluído','Recusado','Update','Em testes','Stand-by','Em análise','Sem efeito','Sem sentido'];

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">— Sem sugestões registadas —</td></tr>';
  } else {
    tbody.innerHTML = filtered.map(d => `
      <tr class="row-fade">
        <td class="td-id">#${d.id}</td>
        <td class="td-discord"><div class="discord-cell">${avatarHtml(d.discord)}<span>${esc(d.discord)}</span></div></td>
        <td class="td-sug">${esc(d.sugestao)}</td>
        <td class="td-desc">${esc(d.descricao || '—')}</td>
        <td>${customSelectHtml(d._docId, 'prioridade', d.prioridade, prioOpts, prioridadeClasse)}</td>
        <td>${customSelectHtml(d._docId, 'feedback', d.feedback, feedOpts, feedbackClasse)}</td>
        <td class="td-comment">
          <div class="comment-cell" data-docid="${d._docId}" data-value="${esc(d.comentario || '')}" onclick="startEditComment(this)">
            ${d.comentario
              ? `<span class="comment-text">${esc(d.comentario)}</span>`
              : '<span class="comment-placeholder">Adicionar...</span>'}
            <span class="comment-icon">✏</span>
          </div>
        </td>
        <td class="td-date">${d.data}</td>
        <td class="td-actions"><button class="btn-del" onclick="deleteEntry('${d._docId}',this)" title="Eliminar">×</button></td>
      </tr>
    `).join('');
  }

  document.getElementById('total-badge').textContent = data.length + (data.length === 1 ? ' sugestão' : ' sugestões');
}

function startEditComment(cell) {
  const docId = cell.dataset.docid;
  const raw = cell.dataset.value.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const td = cell.parentElement;

  const ta = document.createElement('textarea');
  ta.className = 'comment-textarea';
  ta.value = raw;
  ta.placeholder = 'Escreve um comentário...';

  td.innerHTML = '';
  td.appendChild(ta);
  ta.focus();
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight, 36) + 'px';

  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 36) + 'px';
  });

  ta.addEventListener('blur', () => updateField(docId, 'comentario', ta.value.trim()));
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') ta.blur(); });
}

function exportExcel() {
  if (!data.length) { toast('Sem dados para exportar.'); return; }
  const rows = [['ID','Discord','Sugestão','Descrição','Prioridade','Feedback Dev','Comentários','Data']];
  data.forEach(d => rows.push([d.id, d.discord, d.sugestao, d.descricao || '', d.prioridade || '', d.feedback || '', d.comentario || '', d.data]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:6 },{ wch:22 },{ wch:30 },{ wch:40 },{ wch:14 },{ wch:14 },{ wch:30 },{ wch:16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sugestões');
  XLSX.writeFile(wb, 'sugestoes.xlsx');
  toast('Excel exportado!');
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('btn-theme').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['f-discord','f-sug','f-desc'].includes(e.target.id)) addEntry();
});

window.toggleSelect = toggleSelect;
window.selectOption = selectOption;
window.addEntry = addEntry;
window.deleteEntry = deleteEntry;
window.confirmDelete = confirmDelete;
window.updateField = updateField;
window.clearAll = clearAll;
window.sortBy = sortBy;
window.exportExcel = exportExcel;
window.toggleTheme = toggleTheme;
window.renderTable = renderTable;
window.setTab = setTab;
window.setFilter = setFilter;
window.clearSearch = clearSearch;
window.clearFilters = clearFilters;
window.startEditComment = startEditComment;
