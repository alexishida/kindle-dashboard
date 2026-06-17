const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createServer } = require('../backend/server');

const usage = {
  updatedAt: '2026-06-15T00:00:00.000Z',
  source: 'test',
  tools: [{ tool: 'codex', confidence: 'live' }],
};

let server;
let baseUrl;

before(async () => {
  server = createServer({
    collectAll: async () => usage,
    checkAll: () => [{ name: 'test', ok: true }],
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('GET /api/ping reports health', async () => {
  const response = await fetch(`${baseUrl}/api/ping`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('GET /api/usage returns the normalized collector payload', async () => {
  const response = await fetch(`${baseUrl}/api/usage`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), usage);
});

test('GET /api/usage?mock=1 returns mock data without calling collectors', async () => {
  const response = await fetch(`${baseUrl}/api/usage?mock=1`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, 'mock');
  assert.equal(body.tools.length, 3);
  assert.equal(body.tools.find((tool) => tool.tool === 'opencode').label, 'OpenCode Go');
});

test('GET /api/auth returns local credential status', async () => {
  const response = await fetch(`${baseUrl}/api/auth`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.sources, [{ name: 'test', ok: true }]);
});

test('GET /kindle/dash-autostart.sh serves the Kindle launcher', async () => {
  const response = await fetch(`${baseUrl}/kindle/dash-autostart.sh`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain/);
  assert.match(body, /Starts the dashboard loop/);
});

test('GET /dash.png serves the runtime image path provided by Electron', async () => {
  const image = Buffer.from('electron-dashboard-image');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-dashboard-'));
  const imagePath = path.join(tempDir, 'dash.png');
  fs.writeFileSync(imagePath, image);

  const imageServer = createServer({
    collectAll: async () => usage,
    checkAll: () => [],
    dashImagePath: imagePath,
  });
  await new Promise((resolve) => imageServer.listen(0, '127.0.0.1', resolve));

  try {
    const imageUrl = `http://127.0.0.1:${imageServer.address().port}/dash.png`;
    const response = await fetch(imageUrl);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  } finally {
    await new Promise((resolve) => imageServer.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('unknown routes return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not found' });
});
