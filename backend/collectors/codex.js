// Coletor Codex — parse dos rollouts (validado na Fase 0.2). Sem rede.
// Os rate_limits (5h/semanal) são globais da conta e só aparecem em ALGUNS eventos
// token_count (quando a API devolve o header). Por isso varremos os rollouts do mais
// recente para o mais antigo e pegamos o último token_count que TENHA rate_limits.
// total_token_usage é por sessão → pegamos o do rollout mais recente.
const fs = require('fs');
const os = require('os');
const path = require('path');

// O Codex move sessoes encerradas de sessions/ para archived_sessions/. Varremos
// as duas: sessions/ pega a sessao ativa (mais recente), archived_sessions/ o resto.
const CODEX_DIR = path.join(os.homedir(), '.codex');
const ROOTS = [
  path.join(CODEX_DIR, 'sessions'),
  path.join(CODEX_DIR, 'archived_sessions'),
];

function rolloutsByRecency() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) out.push({ p, m: fs.statSync(p).mtimeMs });
    }
  };
  for (const root of ROOTS) walk(root);
  return out.sort((a, b) => b.m - a.m).map((x) => x.p);
}

function* tokenCountsDesc(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i].trim();
    if (!ln) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const p = o.payload || o;
    if (p && p.type === 'token_count') yield p;
  }
}

function pctWindow(rl, key, name) {
  const w = rl && rl[key];
  if (!w) return null;
  const out = { name, pct: w.used_percent };
  if (w.resets_at) out.resets_at = new Date(w.resets_at * 1000).toISOString();
  return out;
}

async function collect() {
  try {
    const files = rolloutsByRecency();
    if (!files.length) throw new Error('nenhum rollout encontrado');

    let rateLimits = null;
    let totalTokens = null;
    // varre do mais recente; para nos dois assim que achar cada um
    for (const f of files) {
      for (const tc of tokenCountsDesc(f)) {
        if (!totalTokens && tc.info && tc.info.total_token_usage) {
          totalTokens = tc.info.total_token_usage.total_tokens;
        }
        if (!rateLimits && tc.rate_limits && (tc.rate_limits.primary || tc.rate_limits.secondary)) {
          rateLimits = tc.rate_limits;
        }
        if (rateLimits && totalTokens != null) break;
      }
      if (rateLimits && totalTokens != null) break;
    }
    if (!rateLimits && totalTokens == null) throw new Error('sem token_count utilizável');

    const tool = { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'live' };
    if (totalTokens != null) tool.tokens = { total: totalTokens };

    // Honestidade: o rate_limit local só vale enquanto a janela não resetou. Se o
    // reset_at da janela 5h já passou, o dado é velho (Codex foi usado pela web/app,
    // não pelo CLI) — não mostrar % expirado como se fosse atual.
    const now = Date.now();
    const reset5h = rateLimits && rateLimits.primary && rateLimits.primary.resets_at * 1000;
    if (rateLimits && reset5h && reset5h > now) {
      const w5 = pctWindow(rateLimits, 'primary', '5h');
      const w7 = pctWindow(rateLimits, 'secondary', '7d');
      if (w5) tool.windows.push(w5);
      if (w7) tool.windows.push(w7);
    } else if (rateLimits) {
      // dado existe mas a janela expirou → marca como obsoleto
      tool.confidence = 'stale';
      tool.staleSince = reset5h ? new Date(reset5h).toISOString() : null;
      tool.note = 'limites locais desatualizados (Codex usado fora do CLI)';
    } else {
      tool.confidence = 'partial';
    }
    return tool;
  } catch (e) {
    return { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'error', error: String(e.message || e) };
  }
}

module.exports = { collect };
