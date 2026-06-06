const express = require('express');
const admin   = require('firebase-admin');
const path    = require('path');

// ── Firebase Admin ─────────────────────────────────────────────
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch {
  console.error('❌  serviceAccountKey.json não encontrado.');
  console.error('   Descarrega em: Firebase Console → Definições → Contas de serviço');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Express ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

// ── API: estatísticas ─────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const snapshot  = await db.collection('sugestoes').get();
    const sugestoes = snapshot.docs.map(d => d.data());
    const total     = sugestoes.length;

    // helpers
    const isConcluido = d => d.prioridade === 'Terminado' && d.feedback === 'Concluído';
    const isRecusado  = d => {
      if (d.prioridade === 'Terminado' && ['Recusado','Sem efeito','Sem sentido'].includes(d.feedback)) return true;
      if (d.prioridade === 'Inviável'  && ['Recusado','Concluído','Sem efeito','Sem sentido'].includes(d.feedback)) return true;
      return false;
    };
    const isAtiva = d => !isConcluido(d) && !isRecusado(d);

    const ativas     = sugestoes.filter(isAtiva).length;
    const concluidas = sugestoes.filter(isConcluido).length;
    const recusadas  = sugestoes.filter(isRecusado).length;

    // por prioridade
    const porPrioridade = {};
    sugestoes.forEach(d => {
      const p = d.prioridade || 'Sem prioridade';
      porPrioridade[p] = (porPrioridade[p] || 0) + 1;
    });

    // por feedback
    const porFeedback = {};
    sugestoes.forEach(d => {
      const f = d.feedback || 'Sem feedback';
      porFeedback[f] = (porFeedback[f] || 0) + 1;
    });

    // top utilizadores
    const porUser = {};
    sugestoes.forEach(d => {
      const u = d.discord || 'Desconhecido';
      porUser[u] = (porUser[u] || 0) + 1;
    });
    const topUsers = Object.entries(porUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome, count]) => ({ nome, count }));

    // sugestões por dia (últimos 14 dias)
    const porDia = {};
    sugestoes.forEach(d => {
      if (!d.data) return;
      const dia = d.data.split(' ')[0];
      porDia[dia] = (porDia[dia] || 0) + 1;
    });

    res.json({ total, ativas, concluidas, recusadas, porPrioridade, porFeedback, topUsers, porDia });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅  Servidor em http://localhost:${PORT}`);
  console.log(`📊  Estatísticas em http://localhost:${PORT}/stats.html`);
});
