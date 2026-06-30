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
const EXPECTED_WINDOWS = ['5h', '7d'];

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
  return out.sort((a, b) => b.m - a.m);
}

function eventTimeMs(raw, payload, fallbackMs) {
  const value = raw && (raw.timestamp || raw.created_at || raw.updated_at)
    || payload && (payload.timestamp || payload.created_at || payload.updated_at);
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function* tokenCountEvents(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const p = o.payload || o;
    if (p && p.type === 'token_count') yield { line: i, raw: o, tokenCount: p };
  }
}

function resetMsForWindow(w) {
  const resetAt = Number(w && w.resets_at);
  return Number.isFinite(resetAt) && resetAt > 0 ? resetAt * 1000 : null;
}

function windowName(key, w) {
  const minutes = Number(
    w && w.window_minutes != null
      ? w.window_minutes
      : w && w.window_seconds != null
        ? w.window_seconds / 60
        : NaN
  );
  if (minutes === 300) return '5h';
  if (minutes === 10080) return '7d';
  if (key === 'primary') return '5h';
  if (key === 'secondary') return '7d';
  return key;
}

function limitWindows(rateLimits) {
  if (!rateLimits) return [];
  const out = [];
  for (const [key, w] of Object.entries(rateLimits)) {
    if (!w || typeof w !== 'object') continue;
    const pct = Number(w.used_percent);
    if (!Number.isFinite(pct)) continue;
    const resetMs = resetMsForWindow(w);
    const item = { name: windowName(key, w), pct, resetMs };
    if (resetMs) item.resets_at = new Date(resetMs).toISOString();
    out.push(item);
  }
  return out;
}

function publicWindow(w) {
  const out = { name: w.name, pct: w.pct };
  if (w.resets_at) out.resets_at = w.resets_at;
  return out;
}

function orderedWindows(windowsByName) {
  const out = [];
  for (const name of EXPECTED_WINDOWS) {
    if (windowsByName.has(name)) out.push(publicWindow(windowsByName.get(name)));
  }
  for (const [name, w] of windowsByName) {
    if (!EXPECTED_WINDOWS.includes(name)) out.push(publicWindow(w));
  }
  return out;
}

async function collect() {
  try {
    const files = rolloutsByRecency();
    if (!files.length) throw new Error('nenhum rollout encontrado');

    const events = [];
    for (const file of files) {
      for (const event of tokenCountEvents(file.p)) {
        events.push({
          ...event,
          fileMtime: file.m,
          observedAt: eventTimeMs(event.raw, event.tokenCount, file.m),
        });
      }
    }
    events.sort((a, b) =>
      (b.observedAt - a.observedAt)
      || (b.fileMtime - a.fileMtime)
      || (b.line - a.line)
    );

    const liveWindows = new Map();
    const staleWindows = new Map();
    let totalTokens = null;
    const now = Date.now();

    // Varre eventos por timestamp real. mtime de arquivo arquivado pode mudar depois.
    for (const event of events) {
      const tc = event.tokenCount;
      if (totalTokens == null && tc.info && tc.info.total_token_usage) {
        totalTokens = tc.info.total_token_usage.total_tokens;
      }
      for (const w of limitWindows(tc.rate_limits)) {
        if (w.resetMs && w.resetMs > now) {
          if (!liveWindows.has(w.name)) liveWindows.set(w.name, w);
        } else if (!staleWindows.has(w.name)) {
          staleWindows.set(w.name, w);
        }
      }
      if (totalTokens != null && EXPECTED_WINDOWS.every((name) => liveWindows.has(name))) break;
    }

    if (!liveWindows.size && !staleWindows.size && totalTokens == null) throw new Error('sem token_count utilizavel');

    const tool = { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'live' };
    if (totalTokens != null) tool.tokens = { total: totalTokens };

    // Honestidade: cada janela local so vale enquanto seu reset_at ainda e futuro.
    if (liveWindows.size) {
      tool.windows = orderedWindows(liveWindows);
    } else if (staleWindows.size) {
      const staleSince = Math.max(...Array.from(staleWindows.values()).map((w) => w.resetMs || 0));
      tool.confidence = 'stale';
      tool.staleSince = staleSince ? new Date(staleSince).toISOString() : null;
      tool.noteKey = 'codexStale';
    } else {
      tool.confidence = 'partial';
    }
    return tool;
  } catch (e) {
    return { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'error', error: String(e.message || e) };
  }
}

module.exports = { collect };
