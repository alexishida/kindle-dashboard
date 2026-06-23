import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { LanguagePreference, SupportedLanguage } from '../shared/types'

interface LocaleMeta {
  currency: string
  locale: string
  name: string
}

interface LocaleData {
  auth?: Record<string, string>
  dashboard?: Record<string, string>
  main?: Record<string, string>
  meta?: LocaleMeta
  ui?: Record<string, string>
}

const FALLBACK: SupportedLanguage = 'en'

let locales: Record<string, LocaleData> = {}
let activeLanguage: SupportedLanguage = FALLBACK

// Lê todos os `locales/*.json` uma vez. Idiomas são descobertos pelo nome do
// arquivo — adicionar um JSON basta, sem tocar no código.
export function loadLocales(): void {
  const dir = join(app.getAppPath(), 'locales')
  const next: Record<string, LocaleData> = {}
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      try {
        next[file.slice(0, -5)] = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LocaleData
      } catch {
        // ignora arquivo de locale inválido; os demais seguem
      }
    }
  } catch {
    // diretório ausente: text() cai para a própria chave
  }
  if (Object.keys(next).length) locales = next
}

export function availableLanguages(): { code: string; name: string }[] {
  return Object.entries(locales).map(([code, data]) => ({ code, name: data.meta?.name ?? code }))
}

export function localeTag(code: SupportedLanguage): string {
  return locales[code]?.meta?.locale ?? 'en-US'
}

// Mapeia um locale do SO (ex.: "pt-BR", "es-419") para um idioma disponível,
// por correspondência exata e depois pelo subtag primário.
export function normalizeLanguage(value: string | undefined): SupportedLanguage {
  const normalized = (value ?? '').toLowerCase()
  const codes = Object.keys(locales)
  const exact = codes.find((code) => code.toLowerCase() === normalized)
  if (exact) return exact
  const primary = normalized.split('-')[0]
  const byPrimary = codes.find((code) => code.toLowerCase().split('-')[0] === primary)
  if (byPrimary) return byPrimary
  return locales[FALLBACK] ? FALLBACK : codes[0] ?? FALLBACK
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  if (value === 'system') return 'system'
  if (typeof value === 'string' && locales[value]) return value
  return 'system'
}

export function currentSystemLanguage(): SupportedLanguage {
  return normalizeLanguage(app.getLocale())
}

export function getActiveLanguage(): SupportedLanguage {
  return activeLanguage
}

function setActiveLanguage(code: SupportedLanguage): void {
  activeLanguage = locales[code] ? code : FALLBACK
}

export function applyLanguagePreference(preference: LanguagePreference): void {
  setActiveLanguage(preference === 'system' ? currentSystemLanguage() : preference)
}

// Resolve uma chave do namespace `main` no idioma ativo, com fallback para `en`.
export function text(key: string, vars?: Record<string, string>): string {
  const active = locales[activeLanguage]?.main ?? {}
  const fallback = locales[FALLBACK]?.main ?? {}
  const template = active[key] ?? fallback[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => vars?.[name] ?? '')
}
