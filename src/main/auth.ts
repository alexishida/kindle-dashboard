import { spawn } from 'node:child_process'
import { app } from 'electron'
import type { AuthLoginTool, AuthStatus } from '../shared/types'
import { authModule } from './backend-bridge'
import { text } from './i18n'

export function getAuthStatus(): AuthStatus {
  const sources = authModule().checkAll()
  return {
    checkedAt: new Date().toISOString(),
    ok: sources.every((source) => source.ok),
    sources,
  }
}

function loginScript(tool: AuthLoginTool): string {
  const label = tool === 'claude' ? 'Claude Code' : 'OpenAI Codex'
  const command = tool === 'claude' ? 'claude' : 'codex login'

  return [
    `$Host.UI.RawUI.WindowTitle = '${text('loginWindow', { label })}'`,
    `Write-Host '${text('loginIntro', { label })}'`,
    "Write-Host ''",
    `Write-Host '${text('loginRun', { command })}'`,
    `Write-Host '${text('loginMissing')}'`,
    "Write-Host ''",
    command,
    "Write-Host ''",
    `Write-Host '${text('loginReturn')}'`,
  ].join('; ')
}

export function openLogin(tool: unknown): void {
  if (tool !== 'claude' && tool !== 'codex') throw new Error(text('invalidTool'))

  if (process.platform === 'win32') {
    const title = text('loginWindow', {
      label: tool === 'claude' ? 'Claude Login' : 'Codex Login',
    })
    const child = spawn('cmd.exe', [
      '/d',
      '/s',
      '/c',
      'start',
      title,
      'powershell.exe',
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      loginScript(tool),
    ], {
      cwd: app.getPath('home'),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return
  }

  const child = spawn(tool === 'claude' ? 'claude' : 'codex login', {
    cwd: app.getPath('home'),
    detached: true,
    shell: true,
    stdio: 'ignore',
  })
  child.unref()
}
