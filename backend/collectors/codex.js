// Coletor Codex - parse dos rollouts (validado na Fase 0.2). Sem rede.
// Os rate_limits (5h/semanal) sao globais da conta e so aparecem em ALGUNS eventos
// token_count (quando a API devolve o header). Por isso varremos os rollouts do mais
// recente para o mais antigo e pegamos total de tokens mais recente junto do melhor
// rate_limit disponivel: preferimos janela ainda valida; se nao existir, caimos no stale.
//
// Homes: alem de ~/.codex (CLI Windows), a extensao do Codex no VSCode roda dentro do
// WSL e grava em /home/<user>/.codex do distro. No Windows lemos essas homes via UNC
// (\\wsl.localhost\<distro>\...). CODEX_EXTRA_HOMES adiciona homes manuais (lista com
// separador de path). CODEX_WSL_SCAN=0/off desliga a varredura do WSL.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFile, spawn } = require('child_process');

const EXPECTED_WINDOWS = ['5h', '7d'];
const WSL_TTL_MS = 5 * 60 * 1000;
const APP_SERVER_TIMEOUT_MS = 5000;

function appServerEnabled() {
  const flag = String(process.env.CODEX_APP_SERVER || '').toLowerCase();
  return !['0', 'off', 'false'].includes(flag);
}

function readAccountData() {
  return new Promise((resolve, reject) => {
    const command = process.env.CODEX_BIN || 'codex';
    let child;
    try {
      child = spawn(command, ['app-server'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });
    } catch (error) {
      reject(error);
      return;
    }

    const responses = new Map();
    const lines = readline.createInterface({ input: child.stdout });
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      lines.close();
      child.kill();
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finish = () => {
      if (settled || !responses.has(1) || !responses.has(2)) return;
      settled = true;
      const result = {
        rateLimits: responses.get(1).rateLimits || {},
        usage: responses.get(2),
      };
      cleanup();
      resolve(result);
    };
    const send = (message) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    const timer = setTimeout(() => fail(new Error('Codex app-server timeout')), APP_SERVER_TIMEOUT_MS);

    child.once('error', fail);
    child.once('exit', (code) => {
      if (!settled) fail(new Error(`Codex app-server exited (${code ?? 'unknown'})`));
    });
    lines.on('line', (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }

      if (message.id === 0) {
        if (message.error) return fail(new Error('Codex app-server initialization failed'));
        send({ method: 'initialized', params: {} });
        send({ method: 'account/rateLimits/read', id: 1, params: null });
        send({ method: 'account/usage/read', id: 2, params: null });
        return;
      }
      if (message.id !== 1 && message.id !== 2) return;
      if (message.error) return fail(new Error('Codex account usage request failed'));
      responses.set(message.id, message.result || {});
      finish();
    });

    send({
      method: 'initialize',
      id: 0,
      params: {
        clientInfo: {
          name: 'kindle_dashboard',
          title: 'Kindle Dashboard',
          version: '1.0.7',
        },
        capabilities: { experimentalApi: true },
      },
    });
  });
}

function localCodexHome() {
  return path.join(os.homedir(), '.codex');
}

function extraCodexHomes() {
  const raw = process.env.CODEX_EXTRA_HOMES;
  if (!raw) return [];
  return raw.split(path.delimiter).map((s) => s.trim()).filter(Boolean);
}

function listWslDistros() {
  return new Promise((resolve) => {
    execFile(
      'wsl.exe',
      ['-l', '-q'],
      { encoding: 'buffer', timeout: 4000, windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err || !stdout || !stdout.length) return resolve([]);
        // wsl.exe emite UTF-16LE com nulls
        const text = Buffer.isBuffer(stdout) ? stdout.toString('utf16le') : String(stdout);
        const names = text.split(/\r?\n/).map((s) => s.replace(/\0/g, '').trim()).filter(Boolean);
        resolve(names);
      }
    );
  });
}

let wslCache = null; // { at, homes }
async function wslCodexHomes() {
  if (process.platform !== 'win32') return [];
  const flag = String(process.env.CODEX_WSL_SCAN || '').toLowerCase();
  if (flag === '0' || flag === 'off' || flag === 'false') return [];
  const now = Date.now();
  if (wslCache && now - wslCache.at < WSL_TTL_MS) return wslCache.homes;

  const homes = [];
  try {
    for (const distro of await listWslDistros()) {
      const base = `//wsl.localhost/${distro}`;
      const candidates = [];
      try {
        for (const user of fs.readdirSync(`${base}/home`)) candidates.push(`${base}/home/${user}/.codex`);
      } catch { /* distro sem /home legivel */ }
      candidates.push(`${base}/root/.codex`);
      for (const home of candidates) {
        try {
          if (fs.existsSync(`${home}/sessions`) || fs.existsSync(`${home}/archived_sessions`)) homes.push(home);
        } catch { /* UNC indisponivel */ }
      }
    }
  } catch { /* WSL ausente/desligado */ }

  wslCache = { at: now, homes };
  return homes;
}

async function codexHomes() {
  const homes = [localCodexHome(), ...extraCodexHomes(), ...(await wslCodexHomes())];
  return [...new Set(homes)];
}

// O Codex move sessoes encerradas de sessions/ para archived_sessions/. Varremos as
// duas em cada home: sessions/ pega a sessao ativa (mais recente), archived_sessions/ o resto.
function sessionRoots(homes) {
  const roots = [];
  for (const home of homes) {
    roots.push(`${home}/sessions`, `${home}/archived_sessions`);
  }
  return roots;
}

// Assincrono para nao bloquear o processo main: a home do WSL vem por UNC e pode ter
// centenas de rollouts. Descidas de diretorio em serie, stats do mesmo nivel em paralelo.
async function rolloutsByRecency(roots) {
  const out = [];
  const walk = async (dir) => {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    const subdirs = [];
    const rolloutFiles = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) subdirs.push(p);
      else if (e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) rolloutFiles.push(p);
    }
    await Promise.all(rolloutFiles.map(async (p) => {
      try { out.push({ p, m: (await fs.promises.stat(p)).mtimeMs }); } catch { /* sumiu no meio */ }
    }));
    for (const d of subdirs) await walk(d);
  };
  for (const root of roots) await walk(root);
  return out.sort((a, b) => b.m - a.m);
}

function eventTimeMs(raw, payload, fallbackMs) {
  const value = raw && (raw.timestamp || raw.created_at || raw.updated_at)
    || payload && (payload.timestamp || payload.created_at || payload.updated_at);
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

async function readTokenCountEvents(file) {
  const events = [];
  let content;
  try { content = await fs.promises.readFile(file, 'utf8'); } catch { return events; }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    let o;
    try { o = JSON.parse(ln); } catch { continue; }
    const p = o.payload || o;
    if (p && p.type === 'token_count') events.push({ line: i, raw: o, tokenCount: p });
  }
  return events;
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

function shapeAccountData(data) {
  const rateLimits = data && data.rateLimits || {};
  const windowsByName = new Map();

  for (const [key, window] of [['primary', rateLimits.primary], ['secondary', rateLimits.secondary]]) {
    if (!window || typeof window !== 'object') continue;
    const pct = Number(window.usedPercent);
    if (!Number.isFinite(pct)) continue;
    const minutes = Number(window.windowDurationMins);
    const resetsAt = Number(window.resetsAt);
    if (Number.isFinite(resetsAt) && resetsAt > 0 && resetsAt * 1000 <= Date.now()) continue;

    const item = { name: windowName(key, { window_minutes: minutes }), pct };
    if (Number.isFinite(resetsAt) && resetsAt > 0) item.resets_at = new Date(resetsAt * 1000).toISOString();
    windowsByName.set(item.name, item);
  }

  const totalTokens = Number(data && data.usage && data.usage.summary && data.usage.summary.lifetimeTokens);
  const windows = orderedWindows(windowsByName);
  if (!windows.length && !Number.isFinite(totalTokens)) throw new Error('Codex account usage unavailable');

  const tool = {
    tool: 'codex',
    label: 'OpenAI Codex',
    windows,
    confidence: windows.length ? 'live' : 'partial',
  };
  if (Number.isFinite(totalTokens)) tool.tokens = { total: totalTokens };
  return tool;
}

// Escolhe total de tokens mais recente + melhor janela por nome, sempre pelo evento com
// maior observedAt (timestamp real do payload; mtime de arquivo arquivado pode mudar).
// Retorna tambem o menor observedAt entre os eventos "vencedores" quando ja temos tudo,
// para o early-exit saber se algum arquivo ainda nao lido poderia mudar a escolha.
function selectFromEvents(events, now) {
  events.sort((a, b) =>
    (b.observedAt - a.observedAt)
    || (b.fileMtime - a.fileMtime)
    || (b.line - a.line)
  );

  const liveWindows = new Map();
  const staleWindows = new Map();
  let totalTokens = null;
  let tokensAt = Infinity;
  const liveAt = new Map();

  for (const event of events) {
    const tc = event.tokenCount;
    if (totalTokens == null && tc.info && tc.info.total_token_usage) {
      totalTokens = tc.info.total_token_usage.total_tokens;
      tokensAt = event.observedAt;
    }
    for (const w of limitWindows(tc.rate_limits)) {
      if (w.resetMs && w.resetMs > now) {
        if (!liveWindows.has(w.name)) { liveWindows.set(w.name, w); liveAt.set(w.name, event.observedAt); }
      } else if (!staleWindows.has(w.name)) {
        staleWindows.set(w.name, w);
      }
    }
    if (totalTokens != null && EXPECTED_WINDOWS.every((name) => liveWindows.has(name))) break;
  }

  const complete = totalTokens != null && EXPECTED_WINDOWS.every((name) => liveWindows.has(name));
  let minWinnerAt = Infinity;
  if (complete) {
    minWinnerAt = tokensAt;
    for (const name of EXPECTED_WINDOWS) minWinnerAt = Math.min(minWinnerAt, liveAt.get(name));
  }
  return { liveWindows, staleWindows, totalTokens, complete, minWinnerAt };
}

async function collectFromRollouts() {
  try {
    const files = await rolloutsByRecency(sessionRoots(await codexHomes()));
    if (!files.length) throw new Error('nenhum rollout encontrado');

    const events = [];
    const now = Date.now();
    let selection = null;

    // Le do mais recente pro mais antigo. Invariante: observedAt de um evento <= mtime do
    // seu arquivo, logo apos ler todos os arquivos com mtime >= X ja vimos todo evento com
    // observedAt > X. Assim paramos cedo quando ja temos tokens + janelas live e o proximo
    // arquivo (mtime menor) nao pode conter evento mais novo que os vencedores.
    for (let i = 0; i < files.length; i++) {
      for (const event of await readTokenCountEvents(files[i].p)) {
        events.push({
          ...event,
          fileMtime: files[i].m,
          observedAt: eventTimeMs(event.raw, event.tokenCount, files[i].m),
        });
      }
      selection = selectFromEvents(events, now);
      const nextMtime = i + 1 < files.length ? files[i + 1].m : -Infinity;
      if (selection.complete && nextMtime < selection.minWinnerAt) break;
    }

    const { liveWindows, staleWindows, totalTokens } = selection;
    if (!liveWindows.size && !staleWindows.size && totalTokens == null) throw new Error('sem token_count utilizavel');

    const tool = { tool: 'codex', label: 'OpenAI Codex', windows: [], confidence: 'live' };
    if (totalTokens != null) tool.tokens = { total: totalTokens };
    const stale = orderedWindows(staleWindows);
    if (stale.length) tool.stale_windows = stale;

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

async function collect(options = {}) {
  if (appServerEnabled()) {
    try {
      const reader = options.readAccountData || readAccountData;
      return shapeAccountData(await reader());
    } catch { /* app-server ausente/antigo: cai para rollouts locais */ }
  }
  return collectFromRollouts();
}

module.exports = { collect };
