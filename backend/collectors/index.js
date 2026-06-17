// Orquestrador dos coletores (Fase 3.4) — roda os três em paralelo, isolados:
// se um falhar, os outros seguem. Devolve o formato normalizado consumido pela render.
const claude = require('./claude');
const codex = require('./codex');
const opencode = require('./opencode');

async function collectAll() {
  const results = await Promise.allSettled([claude.collect(), codex.collect(), opencode.collect()]);
  const tools = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const labels = ['claude', 'codex', 'opencode'];
    return { tool: labels[i], label: labels[i], confidence: 'error', error: String(r.reason) };
  });
  return { updatedAt: new Date().toISOString(), source: 'live', tools };
}

module.exports = { collectAll };
