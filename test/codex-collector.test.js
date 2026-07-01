const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalWslScan = process.env.CODEX_WSL_SCAN;
const originalExtraHomes = process.env.CODEX_EXTRA_HOMES;

function writeRollout(root, relativePath, events) {
  const file = path.join(root, '.codex', relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
  return file;
}

function tokenCountEvent(totalTokens, primaryResetSeconds, secondaryResetSeconds, usedPercent, options = {}) {
  return {
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: { total_tokens: totalTokens },
      },
      rate_limits: {
        primary: primaryResetSeconds
          ? {
              used_percent: usedPercent,
              window_minutes: options.primaryWindowMinutes || 300,
              resets_at: primaryResetSeconds,
            }
          : null,
        secondary: secondaryResetSeconds
          ? {
              used_percent: options.secondaryUsedPercent || 1,
              window_minutes: options.secondaryWindowMinutes || 10080,
              resets_at: secondaryResetSeconds,
            }
          : null,
      },
    },
  };
}

function timestampedEvent(timestampSeconds, event) {
  return {
    timestamp: new Date(timestampSeconds * 1000).toISOString(),
    ...event,
  };
}

function loadCollectorForHome(homeDir) {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  // Isola do WSL da maquina de dev: os testes usam homes sinteticas.
  process.env.CODEX_WSL_SCAN = '0';
  delete process.env.CODEX_EXTRA_HOMES;
  const modulePath = require.resolve('../backend/collectors/codex');
  delete require.cache[modulePath];
  return require('../backend/collectors/codex');
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('HOME', originalHome);
  restoreEnv('USERPROFILE', originalUserProfile);
  restoreEnv('CODEX_WSL_SCAN', originalWslScan);
  restoreEnv('CODEX_EXTRA_HOMES', originalExtraHomes);
  const modulePath = require.resolve('../backend/collectors/codex');
  delete require.cache[modulePath];
});

test('codex collector orders events by payload timestamp over archive mtime', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const older = writeRollout(homeDir, path.join('archived_sessions', 'rollout-old-touched.jsonl'), [
      timestampedEvent(nowSeconds - 120, tokenCountEvent(120000, nowSeconds + 3600, nowSeconds + 86400, 42)),
    ]);
    const newer = writeRollout(homeDir, path.join('sessions', '2026', '06', '30', 'rollout-current.jsonl'), [
      timestampedEvent(nowSeconds - 60, tokenCountEvent(150000, nowSeconds + 3600, nowSeconds + 86400, 73)),
    ]);
    fs.utimesSync(older, new Date(), new Date());
    fs.utimesSync(newer, new Date(Date.now() - 10000), new Date(Date.now() - 10000));

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.windows, [
      { name: '5h', pct: 73, resets_at: new Date((nowSeconds + 3600) * 1000).toISOString() },
      { name: '7d', pct: 1, resets_at: new Date((nowSeconds + 86400) * 1000).toISOString() },
    ]);
    assert.deepEqual(result.tokens, { total: 150000 });
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('codex collector prefers live rate limits over stale fallback', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    writeRollout(homeDir, path.join('archived_sessions', 'rollout-stale.jsonl'), [
      tokenCountEvent(120000, nowSeconds - 3600, nowSeconds + 86400, 90),
    ]);
    writeRollout(homeDir, path.join('archived_sessions', 'rollout-live.jsonl'), [
      tokenCountEvent(110000, nowSeconds + 3600, nowSeconds + 86400 * 3, 6),
    ]);
    writeRollout(homeDir, path.join('sessions', '2026', '06', '18', 'rollout-current.jsonl'), [
      { payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 140748 } } } },
    ]);

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.windows, [
      { name: '5h', pct: 6, resets_at: new Date((nowSeconds + 3600) * 1000).toISOString() },
      { name: '7d', pct: 1, resets_at: new Date((nowSeconds + 86400 * 3) * 1000).toISOString() },
    ]);
    assert.deepEqual(result.tokens, { total: 140748 });
    assert.equal(result.noteKey, undefined);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('codex collector keeps scanning until the live weekly window is found', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const older = writeRollout(homeDir, path.join('archived_sessions', 'rollout-weekly.jsonl'), [
      tokenCountEvent(120000, null, nowSeconds + 86400 * 3, 0),
    ]);
    const newer = writeRollout(homeDir, path.join('sessions', '2026', '06', '18', 'rollout-current.jsonl'), [
      {
        payload: {
          type: 'token_count',
          info: { total_token_usage: { total_tokens: 140748 } },
          rate_limits: {
            primary: { used_percent: 17, window_minutes: 300, resets_at: nowSeconds + 3600 },
          },
        },
      },
    ]);
    fs.utimesSync(older, new Date(Date.now() - 10000), new Date(Date.now() - 10000));
    fs.utimesSync(newer, new Date(), new Date());

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.windows, [
      { name: '5h', pct: 17, resets_at: new Date((nowSeconds + 3600) * 1000).toISOString() },
      { name: '7d', pct: 1, resets_at: new Date((nowSeconds + 86400 * 3) * 1000).toISOString() },
    ]);
    assert.deepEqual(result.tokens, { total: 140748 });
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('codex collector keeps a live weekly window when the five hour window expired', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    writeRollout(homeDir, path.join('archived_sessions', 'rollout-weekly-live.jsonl'), [
      tokenCountEvent(120000, nowSeconds - 3600, nowSeconds + 86400, 90),
    ]);

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.windows, [
      { name: '7d', pct: 1, resets_at: new Date((nowSeconds + 86400) * 1000).toISOString() },
    ]);
    assert.equal(result.noteKey, undefined);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('codex collector names windows from window_minutes when keys drift', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    writeRollout(homeDir, path.join('sessions', '2026', '06', '18', 'rollout-current.jsonl'), [
      tokenCountEvent(120000, nowSeconds + 86400, null, 17, { primaryWindowMinutes: 10080 }),
    ]);

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.windows, [
      { name: '7d', pct: 17, resets_at: new Date((nowSeconds + 86400) * 1000).toISOString() },
    ]);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('codex collector merges rollouts from CODEX_EXTRA_HOMES by recency', async () => {
  const primaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const extraHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-extra-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    // home local: dado mais antigo. home extra (ex.: /home/<user>/.codex do WSL): mais novo.
    writeRollout(primaryHome, path.join('sessions', '2026', '06', '18', 'rollout-local.jsonl'), [
      timestampedEvent(nowSeconds - 600, tokenCountEvent(90000, nowSeconds + 3600, nowSeconds + 86400, 20)),
    ]);
    writeRollout(extraHome, path.join('sessions', '2026', '06', '30', 'rollout-wsl.jsonl'), [
      timestampedEvent(nowSeconds - 60, tokenCountEvent(8628038, nowSeconds + 3600, nowSeconds + 86400, 84)),
    ]);

    const collector = loadCollectorForHome(primaryHome);
    process.env.CODEX_EXTRA_HOMES = path.join(extraHome, '.codex');
    const result = await collector.collect();

    assert.equal(result.confidence, 'live');
    assert.deepEqual(result.tokens, { total: 8628038 });
    assert.equal(result.windows[0].name, '5h');
    assert.equal(result.windows[0].pct, 84);
  } finally {
    fs.rmSync(primaryHome, { recursive: true, force: true });
    fs.rmSync(extraHome, { recursive: true, force: true });
  }
});

test('codex collector marks stale data with a translation key, not raw text', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-codex-'));
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    // todas as janelas ja resetaram -> dado local desatualizado
    writeRollout(homeDir, path.join('archived_sessions', 'rollout-stale.jsonl'), [
      tokenCountEvent(120000, nowSeconds - 3600, nowSeconds - 1800, 90),
    ]);

    const collector = loadCollectorForHome(homeDir);
    const result = await collector.collect();

    assert.equal(result.confidence, 'stale');
    assert.equal(result.noteKey, 'codexStale');
    assert.equal(result.note, undefined);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
