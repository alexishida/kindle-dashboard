const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  dashboardUrl,
  environmentContents,
  positiveInt,
} = require('../scripts/kindle-autostart');

test('dashboardUrl accepts HTTP endpoints and rejects unsafe protocols', () => {
  assert.equal(
    dashboardUrl('http://dashboard.local:8787/dash.png'),
    'http://dashboard.local:8787/dash.png',
  );
  assert.throws(() => dashboardUrl('file:///mnt/us/dash.png'), /http or https/);
  assert.throws(() => dashboardUrl(''), /required/);
});

test('positiveInt falls back for invalid Kindle intervals', () => {
  assert.equal(positiveInt('30', 45), 30);
  assert.equal(positiveInt('0', 45), 45);
  assert.equal(positiveInt('invalid', 45), 45);
});

test('environmentContents safely quotes the generated Kindle configuration', () => {
  const contents = environmentContents({
    DASHBOARD_URL: 'http://dashboard.local:8787/dash.png',
    KINDLE_REFRESH_INTERVAL: '30',
    KINDLE_FULL_REFRESH_EVERY: '10',
    KINDLE_WIFI_RETRY_EVERY: '4',
  });

  assert.match(contents, /^PC='http:\/\/dashboard\.local:8787\/dash\.png'$/m);
  assert.match(contents, /^INTERVAL='30'$/m);
  assert.match(contents, /^FULL_EVERY='10'$/m);
  assert.match(contents, /^WIFI_RETRY_EVERY='4'$/m);
});
