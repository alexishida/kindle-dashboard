import type {
  AuthLoginTool,
  AuthSourceStatus,
  DashboardConfig,
  DashboardConfigInput,
  LanguagePreference,
  SupportedLanguage,
} from '../../../shared/types'
import { localeOf } from '../i18n'
import type { ConfigForm } from '../types'

export function resolveLanguage(
  preference: LanguagePreference | undefined,
  systemLanguage: SupportedLanguage | undefined,
): SupportedLanguage {
  if (preference && preference !== 'system') return preference
  return systemLanguage ?? 'en'
}

export function formatTime(value: string | null, language: SupportedLanguage, waitingLabel: string): string {
  if (!value) return waitingLabel
  return new Date(value).toLocaleString(localeOf(language), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  })
}

// Formata uma data de expiração vinda do preflight (ISO ou "?"). Mantém o valor
// cru quando não for uma data válida, em vez de exibir "Invalid Date".
export function formatExpiry(value: string | undefined, language: SupportedLanguage): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(localeOf(language), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formFromConfig(config: DashboardConfig): ConfigForm {
  return {
    dashboardUrl: config.dashboardUrl,
    kindleFullRefreshEvery: String(config.kindleFullRefreshEvery),
    kindleIp: config.kindleIp,
    kindlePassword: '',
    kindlePort: String(config.kindlePort),
    kindleRefreshInterval: String(config.kindleRefreshInterval),
    kindleUser: config.kindleUser,
    kindleWifiRetryEvery: String(config.kindleWifiRetryEvery),
  }
}

export function inputFromForm(form: ConfigForm): DashboardConfigInput {
  return {
    dashboardUrl: form.dashboardUrl,
    kindleFullRefreshEvery: Number.parseInt(form.kindleFullRefreshEvery, 10),
    kindleIp: form.kindleIp,
    kindlePassword: form.kindlePassword,
    kindlePort: Number.parseInt(form.kindlePort, 10),
    kindleRefreshInterval: Number.parseInt(form.kindleRefreshInterval, 10),
    kindleUser: form.kindleUser,
    kindleWifiRetryEvery: Number.parseInt(form.kindleWifiRetryEvery, 10),
  }
}

export function sourceAction(source: AuthSourceStatus): AuthLoginTool | null {
  if (source.name === 'claude') return 'claude'
  if (source.name === 'codex') return 'codex'
  return null
}

export function dashboardHostFromUrl(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

export function dashboardUrlWithHost(currentUrl: string, host: string): string {
  const trimmedHost = host.trim()
  if (!trimmedHost) return currentUrl

  try {
    const url = new URL(currentUrl)
    url.hostname = trimmedHost
    return url.toString()
  } catch {
    return `http://${trimmedHost}:8787/dash.png`
  }
}
