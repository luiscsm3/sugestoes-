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

const prioridadeClasse = {
  'Urgente': 'badge-urgente',
  'Necessário': 'badge-necessario',
  'Inviável': 'badge-inviavel',
  'Terminado': 'badge-terminado',
  'Não urgente': 'badge-naougente',
  'Stand-by': 'badge-standby'
};

const feedbackClasse = {
  'Em curso': 'badge-emcurso',
  'Concluído': 'badge-concluido',
  'Recusado': 'badge-recusado',
  'Update': 'badge-update',
  'Em testes': 'badge-emtestes',
  'Stand-by': 'badge-standby',
  'Em análise': 'badge-emanalise',
  'Sem efeito': 'badge-semefeito',
};

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
  await addDoc(colRef, { id: nextId, discord, sugestao: sug, descricao: desc, prioridade: '', feedback: '', data: dataStr });

  document.getElementById('f-discord').value = '';
  document.getElementById('f-sug').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-discord').focus();
  toast('Sugestão adicionada!');
}

async function updateField(docId, field, value) {
  await updateDoc(doc(db, "sugestoes", docId), { [field]: value });
}

async function deleteEntry(docId) {
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
  document.getElementById('tab-ativas').classList.toggle('active', tab === 'ativas');
  document.getElementById('tab-recusadas').classList.toggle('active', tab === 'recusadas');
  document.getElementById('tab-concluidos').classList.toggle('active', tab === 'concluidos');
  renderTable();
}

function badgeHtml(value, classeMap) {
  if (!value) return '<span style="color:var(--text-dim);font-size:11px;">—</span>';
  const cls = classeMap[value] || 'badge-default';
  return `<span class="badge ${cls}">${esc(value)}</span>`;
}

function selectHtml(docId, field, value, options) {
  const opts = options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('');
  return `<select class="select-inline" onchange="updateField('${docId}','${field}',this.value)">
    <option value="">—</option>${opts}
  </select>`;
}

function renderTable() {
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  let filtered = data.filter(d =>
    !search ||
    String(d.id).includes(search) ||
    d.discord.toLowerCase().includes(search) ||
    d.sugestao.toLowerCase().includes(search) ||
    (d.descricao || '').toLowerCase().includes(search) ||
    (d.prioridade || '').toLowerCase().includes(search) ||
    (d.feedback || '').toLowerCase().includes(search)
  );

  if (currentTab === 'ativas') {
    filtered = filtered.filter(d => d.feedback !== 'Recusado' && d.feedback !== 'Concluído');
  } else if (currentTab === 'recusadas') {
    filtered = filtered.filter(d => d.feedback === 'Recusado');
  } else if (currentTab === 'concluidos') {
    filtered = filtered.filter(d => d.feedback === 'Concluído');
  }
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (sortCol === 'id') { va = Number(va); vb = Number(vb); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  ['id','discord','sugestao','descricao','prioridade','feedback','data'].forEach(c => {
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
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">— Sem sugestões registadas —</td></tr>';
  } else {
    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td class="td-id">#${d.id}</td>
        <td class="td-discord">${esc(d.discord)}</td>
        <td class="td-sug">${esc(d.sugestao)}</td>
        <td class="td-desc">${esc(d.descricao || '—')}</td>
        <td>${selectHtml(d._docId, 'prioridade', d.prioridade, prioOpts)}</td>
        <td>${selectHtml(d._docId, 'feedback', d.feedback, feedOpts)}</td>
        <td class="td-date">${d.data}</td>
        <td class="td-actions"><button class="btn-del" onclick="deleteEntry('${d._docId}')" title="Eliminar">×</button></td>
      </tr>
    `).join('');
  }

  document.getElementById('total-badge').textContent = data.length + (data.length === 1 ? ' sugestão' : ' sugestões');
}

function exportExcel() {
  if (!data.length) { toast('Sem dados para exportar.'); return; }
  const rows = [['ID','Discord','Sugestão','Descrição','Prioridade','Feedback Dev','Data']];
  data.forEach(d => rows.push([d.id, d.discord, d.sugestao, d.descricao || '', d.prioridade || '', d.feedback || '', d.data]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 },{ wch: 22 },{ wch: 30 },{ wch: 40 },{ wch: 14 },{ wch: 14 },{ wch: 16 }];
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

window.addEntry = addEntry;
window.deleteEntry = deleteEntry;
window.updateField = updateField;
window.clearAll = clearAll;
window.sortBy = sortBy;
window.exportExcel = exportExcel;
window.toggleTheme = toggleTheme;
window.renderTable = renderTable;
window.setTab = setTab;