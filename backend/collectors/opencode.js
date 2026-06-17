// Coletor OpenCode — lê o SQLite local (validado na Fase 0.3). Sem rede.
// A tabela `session` já traz `cost` (USD) calculado pelo próprio OpenCode.
// Saldo do plano Go: confirmado que NÃO há API (fica null).
const { DatabaseSync } = require('node:sqlite');
const os = require('os');
const path = require('path');

const DB = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');

async function collect() {
  let db;
  try {
    db = new DatabaseSync(DB, { readOnly: true });
    const agg = db.prepare(
      'SELECT COUNT(*) sessions, SUM(cost) usd, ' +
      'SUM(tokens_input) tin, SUM(tokens_output) tout FROM session'
    ).get();
    const tool = {
      tool: 'opencode',
      label: 'OpenCode Go',
      spend: { usd: agg.usd || 0, sessions: agg.sessions || 0 },
      tokens: { total: (agg.tin || 0) + (agg.tout || 0) },
      balance: null, // sem API de saldo
      confidence: 'live',
    };
    return tool;
  } catch (e) {
    return { tool: 'opencode', label: 'OpenCode Go', spend: null, balance: null, confidence: 'error', error: String(e.message || e) };
  } finally {
    if (db) try { db.close(); } catch {}
  }
}

module.exports = { collect };
