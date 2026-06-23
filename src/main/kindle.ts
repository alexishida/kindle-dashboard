import type {
  KindleInstallResult,
  KindleScriptStatus,
  KindleStatus,
} from '../shared/types'
import {
  kindleAutostartModule,
  ksshModule,
  type SshClient,
  type SshOptions,
} from './backend-bridge'
import {
  type StoredDashboardConfig,
  decryptPassword,
  loadConfig,
  publicConfig,
  writeConfig,
} from './config'
import { text } from './i18n'

function sshOptions(config: StoredDashboardConfig): SshOptions {
  const password = decryptPassword(config)
  if (!password) throw new Error(text('sshPasswordMissing'))

  return {
    host: config.kindleIp,
    password,
    port: config.kindlePort,
    username: config.kindleUser,
  }
}

function kindleEnvironment(config: StoredDashboardConfig): Record<string, string> {
  return {
    DASHBOARD_URL: config.dashboardUrl,
    KINDLE_FULL_REFRESH_EVERY: String(config.kindleFullRefreshEvery),
    KINDLE_REFRESH_INTERVAL: String(config.kindleRefreshInterval),
    KINDLE_WIFI_RETRY_EVERY: String(config.kindleWifiRetryEvery),
  }
}

function parseKeyValueOutput(output: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index > 0) fields[line.slice(0, index)] = line.slice(index + 1)
  }
  return fields
}

function boolField(fields: Record<string, string>, key: string): boolean {
  return fields[key] === 'yes'
}

export async function checkKindle(): Promise<KindleStatus> {
  const checkedAt = new Date().toISOString()
  const config = await loadConfig()
  let client: SshClient | null = null

  try {
    client = await ksshModule().connect(sshOptions(config))
    const result = await ksshModule().execCommand(client, `
PATH=/sbin:/usr/sbin:/bin:/usr/bin
export PATH
yn() { if "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }
MODEL="$(cat /etc/prettyversion.txt 2>/dev/null || uname -a)"
echo "model=$MODEL"
echo "path=$PATH"
echo "fbink=$(yn command -v fbink)"
echo "initctl=$(yn command -v initctl)"
echo "mntroot=$(yn command -v mntroot)"
echo "mntus=$(yn test -d /mnt/us)"
echo "hotfix=$(yn test -f /etc/upstart/kmc.conf)"
`)

    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`)
    }

    const fields = parseKeyValueOutput(result.stdout)
    const fbink = boolField(fields, 'fbink')
    const initctl = boolField(fields, 'initctl')
    const mntroot = boolField(fields, 'mntroot')
    const mntus = boolField(fields, 'mntus')
    const hotfix = boolField(fields, 'hotfix')
    const jailbroken = fbink && initctl && mntroot && mntus
    const canInstall = jailbroken && hotfix
    const missing = [
      !fbink && 'fbink',
      !initctl && 'initctl',
      !mntroot && 'mntroot',
      !mntus && '/mnt/us',
      !hotfix && 'hotfix/Upstart',
    ].filter(Boolean).join(', ')
    const detail = canInstall
      ? text('verifyReady')
      : text('verifyMissing', { missing, path: fields.path || 'unknown' })

    return {
      canInstall,
      checkedAt,
      connected: true,
      detail,
      fbink,
      hotfix,
      initctl,
      jailbroken,
      mntroot,
      mntus,
      model: fields.model || null,
    }
  } catch (error) {
    return {
      canInstall: false,
      checkedAt,
      connected: false,
      detail: text('verifyFail', { message: error instanceof Error ? error.message : String(error) }),
      fbink: false,
      hotfix: false,
      initctl: false,
      jailbroken: false,
      mntroot: false,
      mntus: false,
      model: null,
    }
  } finally {
    client?.end()
  }
}

export async function installKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()
  const status = await checkKindle()
  if (!status.canInstall) throw new Error(status.detail)

  const result = await kindleAutostartModule().runAction('install', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('installFailed', { code: String(result.code) }))

  const next = { ...config, setupComplete: true }
  await writeConfig(next)

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

export async function uninstallKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()

  const result = await kindleAutostartModule().runAction('uninstall', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('uninstallFailed', { code: String(result.code) }))

  const next = { ...config, setupComplete: false }
  await writeConfig(next)

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

export async function manageKindleScript(action: 'status' | 'start' | 'stop'): Promise<KindleScriptStatus> {
  const config = await loadConfig()
  const result = await kindleAutostartModule().runAction(action, {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || text('scriptActionFailed', { code: String(result.code) }))
  return result.status
}
