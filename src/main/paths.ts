import { execFile } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { PORT } from './constants'

const execFileAsync = promisify(execFile)

let cachedAppCommit =
  process.env.APP_COMMIT?.trim() ||
  process.env.GIT_COMMIT?.trim() ||
  process.env.SOURCE_VERSION?.trim() ||
  ''

export function appAssetPath(name: string): string {
  if (app.isPackaged) return join(process.resourcesPath, name)
  return join(app.getAppPath(), 'build', name)
}

export function runtimeOutputPath(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'runtime', 'dash.png')
  return join(app.getAppPath(), 'out', 'dash.png')
}

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function defaultDashboardUrl(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return `http://${entry.address}:${PORT}/dash.png`
      }
    }
  }

  return `http://127.0.0.1:${PORT}/dash.png`
}

export async function appCommitHash(): Promise<string> {
  if (cachedAppCommit) return cachedAppCommit.slice(0, 7)

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: app.getAppPath(),
      windowsHide: true,
    })
    cachedAppCommit = stdout.trim()
  } catch {
    cachedAppCommit = 'build'
  }

  return cachedAppCommit
}
