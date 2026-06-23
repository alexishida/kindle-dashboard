import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { app, safeStorage } from 'electron'
import type { DashboardConfig, LanguagePreference } from '../shared/types'
import { positiveInt } from './constants'
import { applyLanguagePreference, normalizeLanguagePreference, text } from './i18n'
import { configPath, defaultDashboardUrl } from './paths'

export interface StoredDashboardConfig {
  dashboardUrl: string
  language: LanguagePreference
  kindleFullRefreshEvery: number
  kindleIp: string
  kindlePasswordEncoding?: 'plain' | 'safeStorage'
  kindlePasswordEncrypted?: string
  kindlePasswordPlain?: string
  kindlePort: number
  kindleRefreshInterval: number
  kindleUser: string
  kindleWifiRetryEvery: number
  setupComplete: boolean
}

let dashboardConfig: StoredDashboardConfig | null = null

export function currentConfig(): StoredDashboardConfig | null {
  return dashboardConfig
}

function defaultStoredConfig(): StoredDashboardConfig {
  return {
    dashboardUrl: defaultDashboardUrl(),
    language: 'system',
    kindleFullRefreshEvery: 20,
    kindleIp: '',
    kindlePort: 22,
    kindleRefreshInterval: 45,
    kindleUser: '',
    kindleWifiRetryEvery: 3,
    setupComplete: false,
  }
}

export function decryptPassword(config: StoredDashboardConfig): string {
  if (config.kindlePasswordEncoding === 'safeStorage' && config.kindlePasswordEncrypted) {
    return safeStorage.decryptString(Buffer.from(config.kindlePasswordEncrypted, 'base64'))
  }
  return config.kindlePasswordPlain ?? ''
}

function encryptedPasswordFields(password: string): Partial<StoredDashboardConfig> {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      kindlePasswordEncrypted: safeStorage.encryptString(password).toString('base64'),
      kindlePasswordEncoding: 'safeStorage',
      kindlePasswordPlain: undefined,
    }
  }

  return {
    kindlePasswordEncoding: 'plain',
    kindlePasswordEncrypted: undefined,
    kindlePasswordPlain: password,
  }
}

function hasSavedPassword(config: StoredDashboardConfig): boolean {
  return Boolean(config.kindlePasswordEncrypted || config.kindlePasswordPlain)
}

export function publicConfig(config: StoredDashboardConfig): DashboardConfig {
  return {
    dashboardUrl: config.dashboardUrl,
    kindleFullRefreshEvery: config.kindleFullRefreshEvery,
    kindleIp: config.kindleIp,
    kindlePasswordSaved: hasSavedPassword(config),
    kindlePort: config.kindlePort,
    kindleRefreshInterval: config.kindleRefreshInterval,
    kindleUser: config.kindleUser,
    kindleWifiRetryEvery: config.kindleWifiRetryEvery,
    language: config.language,
    setupComplete: config.setupComplete,
  }
}

export async function loadConfig(): Promise<StoredDashboardConfig> {
  if (dashboardConfig) return dashboardConfig

  const defaults = defaultStoredConfig()
  try {
    const raw = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Partial<StoredDashboardConfig>
    dashboardConfig = {
      ...defaults,
      dashboardUrl: typeof raw.dashboardUrl === 'string' ? raw.dashboardUrl : defaults.dashboardUrl,
      language: normalizeLanguagePreference(raw.language),
      kindleFullRefreshEvery: positiveInt(String(raw.kindleFullRefreshEvery ?? ''), defaults.kindleFullRefreshEvery),
      kindleIp: typeof raw.kindleIp === 'string' ? raw.kindleIp : defaults.kindleIp,
      kindlePasswordEncoding: raw.kindlePasswordEncoding,
      kindlePasswordEncrypted: typeof raw.kindlePasswordEncrypted === 'string' ? raw.kindlePasswordEncrypted : undefined,
      kindlePasswordPlain: typeof raw.kindlePasswordPlain === 'string' ? raw.kindlePasswordPlain : undefined,
      kindlePort: positiveInt(String(raw.kindlePort ?? ''), defaults.kindlePort),
      kindleRefreshInterval: positiveInt(String(raw.kindleRefreshInterval ?? ''), defaults.kindleRefreshInterval),
      kindleUser: typeof raw.kindleUser === 'string' ? raw.kindleUser : defaults.kindleUser,
      kindleWifiRetryEvery: positiveInt(String(raw.kindleWifiRetryEvery ?? ''), defaults.kindleWifiRetryEvery),
      setupComplete: raw.setupComplete === true,
    }
  } catch {
    dashboardConfig = defaults
  }

  return dashboardConfig
}

export async function writeConfig(config: StoredDashboardConfig): Promise<void> {
  dashboardConfig = config
  await fs.mkdir(dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function recordInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(text('configInvalid'))
  }
  return value as Record<string, unknown>
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key]
  if (typeof value !== 'string') throw new Error(text('configText', { field: key }))
  const trimmed = value.trim()
  if (!trimmed) throw new Error(text('configRequired', { field: key }))
  if (trimmed.length > maxLength) throw new Error(text('configTooLong', { field: key }))
  return trimmed
}

function numberField(input: Record<string, unknown>, key: string, fallback: number, max = 65535): number {
  const value = typeof input[key] === 'number' ? (input[key] as number) : Number.parseInt(String(input[key] ?? ''), 10)
  if (!Number.isInteger(value) || value <= 0 || value > max) return fallback
  return value
}

function normalizedDashboardUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(text('dashboardUrlProtocol'))
  }
  return url.toString()
}

export async function saveConfig(raw: unknown): Promise<DashboardConfig> {
  const input = recordInput(raw)
  const previous = await loadConfig()
  const password = typeof input.kindlePassword === 'string' ? input.kindlePassword : ''
  const next: StoredDashboardConfig = {
    ...previous,
    dashboardUrl: normalizedDashboardUrl(requiredString(input, 'dashboardUrl', 500)),
    kindleFullRefreshEvery: numberField(input, 'kindleFullRefreshEvery', previous.kindleFullRefreshEvery, 1000),
    kindleIp: requiredString(input, 'kindleIp', 255),
    kindlePort: numberField(input, 'kindlePort', previous.kindlePort),
    kindleRefreshInterval: numberField(input, 'kindleRefreshInterval', previous.kindleRefreshInterval, 86400),
    kindleUser: requiredString(input, 'kindleUser', 64),
    kindleWifiRetryEvery: numberField(input, 'kindleWifiRetryEvery', previous.kindleWifiRetryEvery, 1000),
  }

  if (password) Object.assign(next, encryptedPasswordFields(password))

  await writeConfig(next)
  return publicConfig(next)
}

export async function setLanguage(raw: unknown): Promise<DashboardConfig> {
  const previous = await loadConfig()
  const next: StoredDashboardConfig = {
    ...previous,
    language: normalizeLanguagePreference(raw),
  }
  await writeConfig(next)
  applyLanguagePreference(next.language)
  return publicConfig(next)
}
