#!/usr/bin/env node
// Backend do Kindle Dashboard.
// - Serve a API JSON normalizada, o render HTML->PNG e o PNG/loop para o Kindle.
// - CORS aberto (Access-Control-Allow-Origin: *).
//
// Sem dependências externas (só core Node). Inicia com: node backend/server.js
// Bind em 0.0.0.0 para ficar acessível na LAN.

const http = require('http');
const fs = require('fs');
const path = require('path');
const collectors = require('./collectors');
const preflight = require('./preflight');

const PORT = parseInt(process.env.PORT || '8787', 10);
const LOCALES_DIR = path.resolve(__dirname, '..', 'locales');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// --- payload mock no formato normalizado (tarefa 3.4). Coletores reais entram na Fase 3. ---
function mockUsage() {
  const now = Date.now();
  return {
    updatedAt: new Date(now).toISOString(),
    source: 'mock',
    tools: [
      {
        tool: 'claude',
        label: 'Claude Code',
        windows: [
          { name: '5h', pct: 30.0, resets_at: '2026-06-14T21:40:00Z' },
          { name: '7d', pct: 3.0, resets_at: '2026-06-20T12:00:00Z' },
        ],
        extra: { used_credits: 3038, monthly_limit: 11000, currency: 'BRL', pct: 27.6, current_balance: 1245 },
        confidence: 'mock',
      },
      {
        tool: 'codex',
        label: 'OpenAI Codex',
        windows: [
          { name: '5h', pct: 33, resets_at: '2026-06-14T21:51:33Z' },
          { name: '7d', pct: 5, resets_at: '2026-06-21T12:00:00Z' },
        ],
        tokens: { total: 5155314 },
        confidence: 'mock',
      },
    ],
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// i18n para a render HTML: devolve só os namespaces que o navegador precisa.
// Valida o código de idioma (evita path traversal) e cai para `en` se faltar.
function readLocaleI18n(lang) {
  const safe = /^[A-Za-z-]{2,12}$/.test(lang) ? lang : 'en';
  try {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${safe}.json`), 'utf8'));
    return { meta: data.meta || {}, dashboard: data.dashboard || {} };
  } catch {
    return safe === 'en' ? { meta: {}, dashboard: {} } : readLocaleI18n('en');
  }
}

function createServer(deps = {}) {
  const collectAll = deps.collectAll || collectors.collectAll;
  const checkAll = deps.checkAll || preflight.checkAll;
  const dashImagePath = deps.dashImagePath || path.join(__dirname, '..', 'out', 'dash.png');

  return http.createServer((req, res) => {
    const requestUrl = req.url || '/';
    const url = requestUrl.split('?')[0];
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (url === '/api/ping') {
      return send(res, 200, JSON.stringify({ ok: true, t: Date.now() }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/auth') {
      return send(res, 200, JSON.stringify({ checkedAt: new Date().toISOString(), sources: checkAll() }), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/i18n') {
      const lang = new URLSearchParams(requestUrl.split('?')[1] || '').get('lang') || 'en';
      return send(res, 200, JSON.stringify(readLocaleI18n(lang)), { 'Content-Type': MIME['.json'] });
    }
    if (url === '/api/usage') {
      if (/[?&]mock=1/.test(requestUrl)) {
        return send(res, 200, JSON.stringify(mockUsage()), { 'Content-Type': MIME['.json'] });
      }
      return collectAll()
        .then((data) => send(res, 200, JSON.stringify(data), { 'Content-Type': MIME['.json'] }))
        .catch((error) => send(res, 500, JSON.stringify({ error: String(error) }), { 'Content-Type': MIME['.json'] }));
    }
    if (url === '/render') {
      return fs.readFile(path.join(__dirname, '..', 'render', 'dashboard.html'), (error, data) =>
        error ? send(res, 404, 'no render') : send(res, 200, data, { 'Content-Type': MIME['.html'] }));
    }
    if (url === '/dash.png') {
      return fs.readFile(dashImagePath, (error, data) =>
        error ? send(res, 404, 'no png') : send(res, 200, data, { 'Content-Type': MIME['.png'] }));
    }
    if (url.startsWith('/kindle/')) {
      const root = path.resolve(__dirname, '..', 'kindle');
      const file = path.resolve(root, url.slice('/kindle/'.length));
      if (!isInside(root, file)) return send(res, 403, 'forbidden');
      return fs.readFile(file, (error, data) =>
        error ? send(res, 404, 'no file') : send(res, 200, data, { 'Content-Type': 'text/plain; charset=utf-8' }));
    }
    return send(res, 404, JSON.stringify({ error: 'not found' }), { 'Content-Type': MIME['.json'] });
  });
}

function start() {
  const server = createServer();

  server.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : PORT;
    console.log(`backend on http://0.0.0.0:${port}`);
    console.log(`  API usage:  http://<PC_IP>:${port}/api/usage`);
    console.log(`  auth:       http://<PC_IP>:${port}/api/auth`);
    console.log(`  PNG:        http://<PC_IP>:${port}/dash.png`);
    preflight.printReport(preflight.checkAll());
  });

  const shutdown = (signal) => {
    console.log(`received ${signal}; shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('unhandled rejection', reason);
    process.exit(1);
  });
  process.on('uncaughtException', (error) => {
    console.error('uncaught exception', error);
    process.exit(1);
  });

  return server;
}

if (require.main === module) start();

module.exports = { createServer, mockUsage, start };
