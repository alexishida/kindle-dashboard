const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

function loadPreflightForHome(homeDir) {
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  const modulePath = require.resolve('../backend/preflight');
  delete require.cache[modulePath];
  return require('../backend/preflight');
}

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  const modulePath = require.resolve('../backend/preflight');
  delete require.cache[modulePath];
});

test('checkAll reports missing credentials as i18n keys, never raw text', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-auth-'));

  try {
    const preflight = loadPreflightForHome(homeDir);
    const sources = preflight.checkAll();

    assert.deepEqual(sources.map((source) => source.name), ['claude', 'codex']);
    for (const source of sources) {
      assert.equal(source.ok, false);
      assert.equal(typeof source.detailKey, 'string');
      assert.equal(typeof source.hintKey, 'string');
      assert.equal(source.detail, undefined);
      assert.equal(source.hint, undefined);
    }
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('checkClaude returns the valid key with an expiry variable', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-auth-'));

  try {
    const expiresAt = Date.now() + 3_600_000;
    const dir = path.join(homeDir, '.claude');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.credentials.json'),
      JSON.stringify({ claudeAiOauth: { accessToken: 'token', expiresAt } }),
    );

    const claude = loadPreflightForHome(homeDir).checkClaude();

    assert.equal(claude.ok, true);
    assert.equal(claude.detailKey, 'valid');
    assert.equal(claude.detailVars.expiresAt, new Date(expiresAt).toISOString());
    assert.equal(claude.hintKey, undefined);
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

test('checkClaude flags an expired token with a renew hint', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-auth-'));

  try {
    const dir = path.join(homeDir, '.claude');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.credentials.json'),
      JSON.stringify({ claudeAiOauth: { accessToken: 'token', expiresAt: Date.now() - 1000 } }),
    );

    const claude = loadPreflightForHome(homeDir).checkClaude();

    assert.equal(claude.ok, false);
    assert.equal(claude.detailKey, 'expired');
    assert.equal(claude.hintKey, 'claudeRenew');
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
