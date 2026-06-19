const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

function writeRollout(root, relativePath, events) {
  const file = path.join(root, '.codex', relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
}

function tokenCountEvent(totalTokens, primaryResetSeconds, secondaryResetSeconds, usedPercent) {
  return {
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: { total_tokens: totalTokens },
      },
      rate_limits: {
        primary: primaryResetSeconds ? { used_percent: usedPercent, resets_at: primaryResetSeconds } : null,
        secondary: secondaryResetSeconds ? { used_percent: 1, resets_at: secondaryResetSeconds } : null,
      },
    },
  };
}

function loadCollectorForHome(homeDir) {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  const modulePath = require.resolve('../backend/collectors/codex');
  delete require.cache[modulePath];
  return require('../backend/collectors/codex');
}

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  const modulePath = require.resolve('../backend/collectors/codex');
  delete require.cache[modulePath];
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
    assert.equal(result.note, undefined);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
