// Orquestrador dos coletores — roda os coletores em paralelo, isolados:
// se um falhar, os outros seguem. Devolve o formato normalizado consumido pela render.
// OpenCode desativado: plano Go não expõe API de saldo/uso — sem dado confiável p/ o dashboard.
// O coletor `./opencode` segue no repo, só não é mais chamado aqui.
const claude = require('./claude');
const codex = require('./codex');

const LABELS = ['claude', 'codex'];

async function collectAll() {
  const results = await Promise.allSettled([claude.collect(), codex.collect()]);
  const tools = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { tool: LABELS[i], label: LABELS[i], confidence: 'error', error: String(r.reason) };
  });
  return { updatedAt: new Date().toISOString(), source: 'live', tools };
}

module.exports = { collectAll };
