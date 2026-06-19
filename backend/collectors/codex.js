// Coletor Codex - parse dos rollouts (validado na Fase 0.2). Sem rede.
// Os rate_limits (5h/semanal) sao globais da conta e so aparecem em ALGUNS eventos
// token_count (quando a API devolve o header). Por isso varremos os rollouts do mais
// recente para o mais antigo e pegamos total de tokens mais recente junto do melhor
// rate_limit disponivel: preferimos janela ainda valida; se nao existir, caimos no stale.
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

function primaryResetMs(rateLimits) {
  const resetAt = rateLimits && rateLimits.primary && rateLimits.primary.resets_at;
  return resetAt ? resetAt * 1000 : null;
}

async function collect() {
  try {
    const files = rolloutsByRecency();
    if (!files.length) throw new Error('nenhum rollout encontrado');

    let liveRateLimits = null;
    let staleRateLimits = null;
    let totalTokens = null;
    const now = Date.now();

    // varre do mais recente; para cedo se ja tivermos tokens + limite vivo
    for (const f of files) {
      for (const tc of tokenCountsDesc(f)) {
        if (!totalTokens && tc.info && tc.info.total_token_usage) {
          totalTokens = tc.info.total_token_usage.total_tokens;
        }
        if (tc.rate_limits && (tc.rate_limits.primary || tc.rate_limits.secondary)) {
          const reset5h = primaryResetMs(tc.rate_limits);
          if (!liveRateLimits && reset5h && reset5h > now) {
            liveRateLimits = tc.rate_limits;
          } else if (!staleRateLimits) {
            staleRateLimits = tc.rate_limits;
          }
        }
        if (liveRateLimits && totalTokens != null) break;
      }
      if (liveRateLimits && totalTokens != null) break;
    }

    const rateLimits = liveRateLimits || staleRateLimits;
    if (!rateLimits && totalTokens == null) throw new Error('sem token_count utilizavel');

    const tool = { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'live' };
    if (totalTokens != null) tool.tokens = { total: totalTokens };

    // Honestidade: rate_limit local so vale enquanto janela nao resetou. Se reset_at
    // da janela 5h ja passou, dado ficou velho (Codex usado pela web/app, nao pelo CLI).
    const reset5h = primaryResetMs(rateLimits);
    if (rateLimits && reset5h && reset5h > now) {
      const w5 = pctWindow(rateLimits, 'primary', '5h');
      const w7 = pctWindow(rateLimits, 'secondary', '7d');
      if (w5) tool.windows.push(w5);
      if (w7) tool.windows.push(w7);
    } else if (rateLimits) {
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
