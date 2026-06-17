#!/usr/bin/env node
const { spawn } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.dirname(require.resolve('electron-vite/package.json'));
const cli = path.join(packageRoot, 'bin', 'electron-vite.js');
const env = { ...process.env };

// If this leaks into the Electron child process, electron.exe behaves like Node
// and the main process cannot access require('electron').app.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
