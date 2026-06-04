import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
  await addDoc(colRef, { id: nextId, discord, sugestao: sug, descricao: desc, data: dataStr });

  document.getElementById('f-discord').value = '';
  document.getElementById('f-sug').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-discord').focus();
  toast('Sugestão adicionada!');
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

function renderTable() {
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  let filtered = data.filter(d =>
    !search ||
    String(d.id).includes(search) ||
    d.discord.toLowerCase().includes(search) ||
    d.sugestao.toLowerCase().includes(search) ||
    (d.descricao || '').toLowerCase().includes(search)
  );

  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (sortCol === 'id') { va = Number(va); vb = Number(vb); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  ['id','discord','sugestao','descricao','data'].forEach(c => {
    const th = document.getElementById('th-' + c);
    if (!th) return;
    th.classList.toggle('sorted', sortCol === c);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = sortCol === c ? (sortAsc ? '↑' : '↓') : '↕';
  });

  const tbody = document.getElementById('tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">— Sem sugestões registadas —</td></tr>';
  } else {
    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td class="td-id">#${d.id}</td>
        <td class="td-discord">${esc(d.discord)}</td>
        <td class="td-sug">${esc(d.sugestao)}</td>
        <td class="td-desc">${esc(d.descricao || '—')}</td>
        <td class="td-date">${d.data}</td>
        <td class="td-actions"><button class="btn-del" onclick="deleteEntry('${d._docId}')" title="Eliminar">×</button></td>
      </tr>
    `).join('');
  }

  document.getElementById('total-badge').textContent = data.length + (data.length === 1 ? ' sugestão' : ' sugestões');
}

function exportExcel() {
  if (!data.length) { toast('Sem dados para exportar.'); return; }
  const rows = [['ID', 'Discord', 'Sugestão', 'Descrição', 'Data']];
  data.forEach(d => rows.push([d.id, d.discord, d.sugestao, d.descricao || '', d.data]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 30 }, { wch: 40 }, { wch: 16 }];
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
window.clearAll = clearAll;
window.sortBy = sortBy;
window.exportExcel = exportExcel;
window.toggleTheme = toggleTheme;
window.renderTable = renderTable;