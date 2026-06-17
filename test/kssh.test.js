const assert = require('node:assert/strict');
const { test } = require('node:test');
const { connectionConfig, shellQuote } = require('../scripts/kssh');

test('shellQuote protects spaces and apostrophes in remote paths', () => {
  assert.equal(shellQuote('/mnt/us/a file.txt'), "'/mnt/us/a file.txt'");
  assert.equal(shellQuote("/mnt/us/user's file.txt"), "'/mnt/us/user'\\''s file.txt'");
});

test('connectionConfig accepts explicit Electron settings without private defaults', () => {
  const config = connectionConfig({
    host: 'kindle.local',
    password: 'example-password',
    port: 2222,
    username: 'example-user',
  });

  assert.equal(config.host, 'kindle.local');
  assert.equal(config.port, 2222);
  assert.equal(config.username, 'example-user');
  assert.equal(config.password, 'example-password');
});
