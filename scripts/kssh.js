#!/usr/bin/env node
// SSH helper for the Kindle using password authentication.
//
// Usage:
//   node scripts/kssh.js run "<shell command>"
//   node scripts/kssh.js put <local-file> <remote-file>
//   node scripts/kssh.js putdir <local-directory> <remote-directory>
//
// Environment:
//   KINDLE_IP, KINDLE_USER, KINDLE_PW

const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function connectionConfig(options = {}) {
  const env = options.env || process.env;
  return {
    host: options.host || env.KINDLE_IP || '',
    port: Number.parseInt(String(options.port || env.KINDLE_PORT || '22'), 10),
    username: options.username || env.KINDLE_USER || '',
    password: options.password || env.KINDLE_PW || '',
    readyTimeout: options.readyTimeout || 12000,
    keepaliveInterval: options.keepaliveInterval || 5000,
  };
}

function assertConnectionConfig(config) {
  if (!config.host) throw new Error('KINDLE_IP is required');
  if (!Number.isInteger(config.port) || config.port <= 0) throw new Error('KINDLE_PORT is invalid');
  if (!config.username) throw new Error('KINDLE_USER is required');
  if (!config.password) throw new Error('KINDLE_PW is required');
}

function connect(options = {}) {
  return new Promise((resolve, reject) => {
    const config = connectionConfig(options);
    assertConnectionConfig(config);

    const client = new Client();
    const onError = (error) => reject(error);

    client.once('error', onError);
    client.once('ready', () => {
      client.removeListener('error', onError);
      resolve(client);
    });
    client.connect(config);
  });
}

function execCommand(client, command, options = {}) {
  const { stdin, streamOutput = false } = options;

  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      const stdout = [];
      const stderr = [];

      stream.on('data', (chunk) => {
        if (streamOutput) process.stdout.write(chunk);
        else stdout.push(chunk);
      });
      stream.stderr.on('data', (chunk) => {
        if (streamOutput) process.stderr.write(chunk);
        else stderr.push(chunk);
      });
      stream.once('error', reject);
      stream.once('close', (code, signal) => {
        resolve({
          code: Number.isInteger(code) ? code : signal ? 1 : 0,
          signal,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        });
      });

      if (stdin) {
        stdin.once('error', reject);
        stdin.pipe(stream);
      }
      else stream.end();
    });
  });
}

async function uploadFile(client, localFile, remoteFile) {
  const stat = await fs.promises.stat(localFile);
  if (!stat.isFile()) throw new Error(`not a file: ${localFile}`);

  const input = fs.createReadStream(localFile);
  const result = await execCommand(client, `cat > ${shellQuote(remoteFile)}`, { stdin: input });
  if (result.code !== 0) {
    throw new Error(`upload failed (${result.code}): ${result.stderr.trim()}`);
  }
}

async function listFiles(root) {
  const output = [];

  async function walk(current, relative) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = path.join(current, entry.name);
      const relativePath = relative ? path.join(relative, entry.name) : entry.name;
      if (entry.isDirectory()) await walk(localPath, relativePath);
      else if (entry.isFile()) output.push({ localPath, relativePath });
    }
  }

  await walk(root, '');
  return output;
}

async function uploadDirectory(client, localDirectory, remoteDirectory) {
  const stat = await fs.promises.stat(localDirectory);
  if (!stat.isDirectory()) throw new Error(`not a directory: ${localDirectory}`);

  const rootResult = await execCommand(client, `mkdir -p ${shellQuote(remoteDirectory)}`);
  if (rootResult.code !== 0) throw new Error(`mkdir failed: ${rootResult.stderr.trim()}`);

  const files = await listFiles(localDirectory);
  const createdDirectories = new Set([remoteDirectory]);

  for (const file of files) {
    const relative = file.relativePath.split(path.sep).join('/');
    const remoteFile = path.posix.join(remoteDirectory, relative);
    const remoteParent = path.posix.dirname(remoteFile);

    if (!createdDirectories.has(remoteParent)) {
      const result = await execCommand(client, `mkdir -p ${shellQuote(remoteParent)}`);
      if (result.code !== 0) throw new Error(`mkdir failed: ${result.stderr.trim()}`);
      createdDirectories.add(remoteParent);
    }

    await uploadFile(client, file.localPath, remoteFile);
    console.log(`put ${remoteFile}`);
  }
}

function printUsage() {
  console.error([
    'Usage:',
    '  node scripts/kssh.js run "<shell command>"',
    '  node scripts/kssh.js put <local-file> <remote-file>',
    '  node scripts/kssh.js putdir <local-directory> <remote-directory>',
  ].join('\n'));
}

async function main(args = process.argv.slice(2)) {
  const [action, ...values] = args;
  if (!action) {
    printUsage();
    return 2;
  }

  const client = await connect();
  try {
    if (action === 'run' && values.length === 1) {
      const result = await execCommand(client, values[0], { streamOutput: true });
      return result.code;
    }
    if (action === 'put' && values.length === 2) {
      await uploadFile(client, path.resolve(values[0]), values[1]);
      console.log(`put OK -> ${values[1]}`);
      return 0;
    }
    if (action === 'putdir' && values.length === 2) {
      await uploadDirectory(client, path.resolve(values[0]), values[1]);
      console.log(`putdir OK -> ${values[1]}`);
      return 0;
    }

    printUsage();
    return 2;
  } finally {
    client.end();
  }
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`kssh: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  assertConnectionConfig,
  connect,
  connectionConfig,
  execCommand,
  listFiles,
  main,
  shellQuote,
  uploadDirectory,
  uploadFile,
};
