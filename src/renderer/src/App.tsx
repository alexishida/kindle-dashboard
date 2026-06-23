import { useCallback, useEffect, useMemo, useState } from 'react'
import PreviewFrame from './PreviewFrame'
import type {
  AuthLoginTool,
  AuthSourceStatus,
  AuthStatus,
  DashboardConfig,
  DashboardConfigInput,
  KindleScriptStatus,
  KindleStatus,
  LanguagePreference,
  RenderResult,
  RuntimeInfo,
  SupportedLanguage,
} from '../../shared/types'

type BackendState = 'checking' | 'online' | 'offline'
type NavKey = 'painel' | 'kindle' | 'logins' | 'configuracoes'
type KindleTab = 'config' | 'diagnostico'
type KindleScriptAction = 'start' | 'stop'
type IconName =
  | 'book'
  | 'kindle'
  | 'login'
  | 'refresh'
  | 'settings'
  | 'stethoscope'
  | 'save'
  | 'download'
  | 'trash'
  | 'play'
  | 'stop'
  | 'search'
  | 'github'
  | 'globe'

interface NavItem {
  key: NavKey
  label: string
  hint: string
  icon: IconName
}

interface ConfigForm {
  dashboardUrl: string
  kindleFullRefreshEvery: string
  kindleIp: string
  kindlePassword: string
  kindlePort: string
  kindleRefreshInterval: string
  kindleUser: string
  kindleWifiRetryEvery: string
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  iconOnly?: boolean
}

const COPY: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    action: 'Action',
    appLoading: 'Starting dashboard...',
    authChecking: 'Checking...',
    authEyebrow: 'Diagnostics',
    authLoading: 'Loading authentication status...',
    authRecheck: 'Recheck',
    authTitle: 'Source logins',
    autostart: 'Autostart',
    autostartActive: 'Active',
    autostartInactive: 'Inactive',
    backend: 'Backend',
    backendChecking: 'Checking backend',
    backendOffline: 'Backend offline',
    backendOnline: 'Backend online',
    backendPending: 'Setup pending',
    checkKindle: 'Check Kindle',
    checkingKindle: 'Checking...',
    configBadgePending: 'Pending',
    configBadgeReady: 'Ready',
    configSaved: 'Settings saved',
    configSectionEyebrow: 'Setup',
    configSectionTitle: 'Kindle settings',
    configureKindleFirst: 'Configure Kindle first',
    connectionReady: 'Kindle connected',
    connectionFail: 'Kindle not found',
    dashboardGeneratedUrl: 'Generated URL: {value}',
    dashboardHost: 'PC IP',
    dashboardHostPlaceholder: 'e.g. 192.168.0.10',
    detailsTechnical: 'Technical details',
    diagnosticEmpty: 'After jailbreak, enable USBNetwork/KUAL and click Check Kindle.',
    diagnosticScriptEmpty: 'Check the Kindle to see script status.',
    diagnosticsInstall: 'Diagnostics and script install',
    downloadInterval: 'Kindle download (seconds)',
    fieldKindleIp: 'Kindle IP',
    fieldKindleIpPlaceholder: 'e.g. Kindle IP',
    fieldPassword: 'SSH password',
    fieldPasswordPlaceholder: 'Kindle password',
    fieldPasswordSaved: 'saved password; fill in to replace',
    fieldPort: 'SSH port',
    fieldUser: 'SSH user',
    fieldWifiRetry: 'Wi-Fi retry (consecutive failures)',
    fullRefresh: 'Full refresh (cycles)',
    githubOpen: 'Open repository on GitHub',
    hintDashboard: 'Preview and status',
    hintKindle: 'Device and scripts',
    hintLogins: 'Source authentication',
    hintSettings: 'General preferences',
    installScripts: 'Install scripts',
    installing: 'Installing...',
    installed: 'Installed',
    languageAuto: 'Use system language',
    languageDetected: 'Detected system language: {value}',
    languageField: 'Language',
    languageSaved: 'Language updated',
    languageSectionEyebrow: 'Preferences',
    languageSectionTitle: 'Interface language',
    lastImage: 'Last image',
    loading: 'Waiting',
    loginButton: 'Login',
    loop: 'Loop',
    loopRunning: 'Running',
    loopStopped: 'Stopped',
    menuDashboard: 'Dashboard',
    menuKindle: 'Kindle',
    menuLogins: 'Logins',
    menuSettings: 'Settings',
    openSettingsTitle: 'Settings',
    ok: 'OK',
    panelBrandTitle: 'Kindle Dashboard',
    refreshNow: 'Refresh now',
    refreshNowBusy: 'Refreshing...',
    reqFbink: 'Shows image on screen',
    reqHotfix: 'Startup patch installed',
    reqJailbreak: 'Root access enabled',
    reqReady: 'Ready for script install',
    save: 'Save',
    saving: 'Saving...',
    scriptStarted: 'Script started on Kindle',
    scriptStopped: 'Script stopped on Kindle',
    scriptsInstalled: 'Scripts installed on Kindle',
    scriptsRemoved: 'Scripts removed from Kindle',
    settingsTitle: 'Settings',
    sourceLoginOpenedClaude: 'Claude login window opened',
    sourceLoginOpenedCodex: 'Codex login window opened',
    startScript: 'Start script',
    starting: 'Starting...',
    statusInstalledMissing: 'Missing',
    step1Sub: 'Checks SSH, jailbreak and required tools on device.',
    step1Title: 'Connect and verify',
    step2Sub: 'Installs dashboard autostart on Kindle.',
    step2Title: 'Install scripts',
    step3Sub: 'Starts or stops the loop that refreshes the screen.',
    step3Title: 'Run on Kindle',
    stopScript: 'Stop script',
    stopping: 'Stopping...',
    uninstall: 'Uninstall',
    uninstallBusy: 'Uninstalling...',
    uninstallConfirm: 'Uninstall Kindle scripts? Dashboard autostart will be removed from device.',
    updatedAt: 'Updated',
  },
  'pt-BR': {
    action: 'Ação',
    appLoading: 'Iniciando o dashboard...',
    authChecking: 'Checando...',
    authEyebrow: 'Diagnóstico',
    authLoading: 'Carregando status de autenticação...',
    authRecheck: 'Reverificar',
    authTitle: 'Login das fontes',
    autostart: 'Autostart',
    autostartActive: 'Ativo',
    autostartInactive: 'Inativo',
    backend: 'Backend',
    backendChecking: 'Verificando backend',
    backendOffline: 'Backend offline',
    backendOnline: 'Backend online',
    backendPending: 'Setup pendente',
    checkKindle: 'Verificar Kindle',
    checkingKindle: 'Verificando...',
    configBadgePending: 'Pendente',
    configBadgeReady: 'Pronto',
    configSaved: 'Configuração salva',
    configSectionEyebrow: 'Setup',
    configSectionTitle: 'Configuração do Kindle',
    configureKindleFirst: 'Configure o Kindle primeiro',
    connectionReady: 'Kindle conectado',
    connectionFail: 'Kindle não encontrado',
    dashboardGeneratedUrl: 'URL gerada: {value}',
    dashboardHost: 'IP do PC',
    dashboardHostPlaceholder: 'ex.: 192.168.0.10',
    detailsTechnical: 'Detalhes técnicos',
    diagnosticEmpty: 'Depois do jailbreak, ative USBNetwork/KUAL e toque em Verificar Kindle.',
    diagnosticScriptEmpty: 'Verifique o Kindle para ver o estado do script.',
    diagnosticsInstall: 'Diagnóstico e scripts',
    downloadInterval: 'Download Kindle (segundos)',
    fieldKindleIp: 'IP do Kindle',
    fieldKindleIpPlaceholder: 'ex.: IP do Kindle',
    fieldPassword: 'Senha SSH',
    fieldPasswordPlaceholder: 'senha do Kindle',
    fieldPasswordSaved: 'senha salva; preencha para trocar',
    fieldPort: 'Porta SSH',
    fieldUser: 'Usuário SSH',
    fieldWifiRetry: 'Retry Wi-Fi (falhas seguidas)',
    fullRefresh: 'Refresh completo (ciclos)',
    githubOpen: 'Abrir repositório no GitHub',
    hintDashboard: 'Prévia e estado',
    hintKindle: 'Conexão e scripts',
    hintLogins: 'Autenticação das fontes',
    hintSettings: 'Idioma e preferências',
    installScripts: 'Instalar scripts',
    installing: 'Instalando...',
    installed: 'Instalado',
    languageAuto: 'Usar idioma do sistema',
    languageDetected: 'Idioma detectado do sistema: {value}',
    languageField: 'Idioma',
    languageSaved: 'Idioma atualizado',
    languageSectionEyebrow: 'Preferências',
    languageSectionTitle: 'Idioma da interface',
    lastImage: 'Última imagem',
    loading: 'aguardando',
    loginButton: 'Login',
    loop: 'Loop',
    loopRunning: 'Rodando',
    loopStopped: 'Parado',
    menuDashboard: 'Painel',
    menuKindle: 'Kindle',
    menuLogins: 'Logins',
    menuSettings: 'Configurações',
    openSettingsTitle: 'Configurações',
    ok: 'OK',
    panelBrandTitle: 'Kindle Dashboard',
    refreshNow: 'Atualizar agora',
    refreshNowBusy: 'Atualizando...',
    reqFbink: 'Mostra a imagem na tela',
    reqHotfix: 'Correção de inicialização',
    reqJailbreak: 'Acesso root liberado',
    reqReady: 'Pode instalar os scripts',
    save: 'Salvar',
    saving: 'Salvando...',
    scriptStarted: 'Script iniciado no Kindle',
    scriptStopped: 'Script parado no Kindle',
    scriptsInstalled: 'Scripts instalados no Kindle',
    scriptsRemoved: 'Scripts desinstalados do Kindle',
    settingsTitle: 'Configurações',
    sourceLoginOpenedClaude: 'Janela de login do Claude aberta',
    sourceLoginOpenedCodex: 'Janela de login do Codex aberta',
    startScript: 'Iniciar script',
    starting: 'Iniciando...',
    statusInstalledMissing: 'Ausente',
    step1Sub: 'Confere SSH, jailbreak e ferramentas no aparelho.',
    step1Title: 'Conectar e verificar',
    step2Sub: 'Coloca o autostart do dashboard no Kindle.',
    step2Title: 'Instalar scripts',
    step3Sub: 'Liga ou desliga o loop que atualiza a tela.',
    step3Title: 'Executar no Kindle',
    stopScript: 'Parar script',
    stopping: 'Parando...',
    uninstall: 'Desinstalar',
    uninstallBusy: 'Desinstalando...',
    uninstallConfirm: 'Desinstalar os scripts do Kindle? O autostart do dashboard será removido do aparelho.',
    updatedAt: 'Atualizado',
  },
  es: {
    action: 'Acción',
    appLoading: 'Iniciando dashboard...',
    authChecking: 'Verificando...',
    authEyebrow: 'Diagnóstico',
    authLoading: 'Cargando estado de autenticación...',
    authRecheck: 'Verificar de nuevo',
    authTitle: 'Inicio de sesión de fuentes',
    autostart: 'Autostart',
    autostartActive: 'Activo',
    autostartInactive: 'Inactivo',
    backend: 'Backend',
    backendChecking: 'Verificando backend',
    backendOffline: 'Backend offline',
    backendOnline: 'Backend online',
    backendPending: 'Configuración pendiente',
    checkKindle: 'Verificar Kindle',
    checkingKindle: 'Verificando...',
    configBadgePending: 'Pendiente',
    configBadgeReady: 'Listo',
    configSaved: 'Configuración guardada',
    configSectionEyebrow: 'Setup',
    configSectionTitle: 'Configuración de Kindle',
    configureKindleFirst: 'Configure Kindle primero',
    connectionReady: 'Kindle conectado',
    connectionFail: 'Kindle no encontrado',
    dashboardGeneratedUrl: 'URL generada: {value}',
    dashboardHost: 'IP de PC',
    dashboardHostPlaceholder: 'ej.: 192.168.0.10',
    detailsTechnical: 'Detalles técnicos',
    diagnosticEmpty: 'Después del jailbreak, active USBNetwork/KUAL y pulse Verificar Kindle.',
    diagnosticScriptEmpty: 'Verifique Kindle para ver estado del script.',
    diagnosticsInstall: 'Diagnóstico y scripts',
    downloadInterval: 'Descarga de Kindle (segundos)',
    fieldKindleIp: 'IP de Kindle',
    fieldKindleIpPlaceholder: 'ej.: IP de Kindle',
    fieldPassword: 'Contraseña SSH',
    fieldPasswordPlaceholder: 'contraseña de Kindle',
    fieldPasswordSaved: 'contraseña guardada; complete para cambiar',
    fieldPort: 'Puerto SSH',
    fieldUser: 'Usuario SSH',
    fieldWifiRetry: 'Retry Wi-Fi (fallos seguidos)',
    fullRefresh: 'Refresh completo (ciclos)',
    githubOpen: 'Abrir repositorio en GitHub',
    hintDashboard: 'Vista previa y estado',
    hintKindle: 'Dispositivo y scripts',
    hintLogins: 'Autenticación de fuentes',
    hintSettings: 'Idioma y preferencias',
    installScripts: 'Instalar scripts',
    installing: 'Instalando...',
    installed: 'Instalado',
    languageAuto: 'Usar idioma del sistema',
    languageDetected: 'Idioma detectado del sistema: {value}',
    languageField: 'Idioma',
    languageSaved: 'Idioma actualizado',
    languageSectionEyebrow: 'Preferencias',
    languageSectionTitle: 'Idioma de la interfaz',
    lastImage: 'Última imagen',
    loading: 'esperando',
    loginButton: 'Login',
    loop: 'Loop',
    loopRunning: 'Ejecutándose',
    loopStopped: 'Detenido',
    menuDashboard: 'Panel',
    menuKindle: 'Kindle',
    menuLogins: 'Logins',
    menuSettings: 'Configuración',
    openSettingsTitle: 'Configuración',
    ok: 'OK',
    panelBrandTitle: 'Kindle Dashboard',
    refreshNow: 'Actualizar ahora',
    refreshNowBusy: 'Actualizando...',
    reqFbink: 'Muestra imagen en pantalla',
    reqHotfix: 'Parche de arranque',
    reqJailbreak: 'Acceso root habilitado',
    reqReady: 'Puede instalar scripts',
    save: 'Guardar',
    saving: 'Guardando...',
    scriptStarted: 'Script iniciado en Kindle',
    scriptStopped: 'Script detenido en Kindle',
    scriptsInstalled: 'Scripts instalados en Kindle',
    scriptsRemoved: 'Scripts desinstalados de Kindle',
    settingsTitle: 'Configuración',
    sourceLoginOpenedClaude: 'Ventana de login de Claude abierta',
    sourceLoginOpenedCodex: 'Ventana de login de Codex abierta',
    startScript: 'Iniciar script',
    starting: 'Iniciando...',
    statusInstalledMissing: 'Ausente',
    step1Sub: 'Comprueba SSH, jailbreak y herramientas en dispositivo.',
    step1Title: 'Conectar y verificar',
    step2Sub: 'Instala autostart del dashboard en Kindle.',
    step2Title: 'Instalar scripts',
    step3Sub: 'Inicia o detiene el loop que actualiza la pantalla.',
    step3Title: 'Ejecutar en Kindle',
    stopScript: 'Detener script',
    stopping: 'Deteniendo...',
    uninstall: 'Desinstalar',
    uninstallBusy: 'Desinstalando...',
    uninstallConfirm: '¿Desinstalar los scripts de Kindle? El autostart del dashboard será removido del dispositivo.',
    updatedAt: 'Actualizado',
  },
}

function resolveLanguage(preference: LanguagePreference | undefined, systemLanguage: SupportedLanguage | undefined): SupportedLanguage {
  if (preference && preference !== 'system') return preference
  return systemLanguage ?? 'en'
}

function localeForLanguage(language: SupportedLanguage): string {
  if (language === 'pt-BR') return 'pt-BR'
  if (language === 'es') return 'es-ES'
  return 'en-US'
}

function formatTime(value: string | null, language: SupportedLanguage, waitingLabel: string): string {
  if (!value) return waitingLabel
  return new Date(value).toLocaleString(localeForLanguage(language), {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  })
}

function formFromConfig(config: DashboardConfig): ConfigForm {
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

function inputFromForm(form: ConfigForm): DashboardConfigInput {
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

function sourceAction(source: AuthSourceStatus): AuthLoginTool | null {
  if (source.name === 'claude') return 'claude'
  if (source.name === 'codex') return 'codex'
  return null
}

function dashboardHostFromUrl(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

function dashboardUrlWithHost(currentUrl: string, host: string): string {
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

function ReqChip({ ok, label, desc }: { ok: boolean; label: string; desc: string }): React.JSX.Element {
  return (
    <div className={`req-chip ${ok ? 'ok' : 'bad'}`}>
      <span className="req-icon" aria-hidden="true">{ok ? '✓' : '✕'}</span>
      <span className="req-body">
        <span className="req-label">{label}</span>
        <span className="req-desc">{desc}</span>
      </span>
    </div>
  )
}

function ExecPill({ ok, label, value }: { ok: boolean; label: string; value: string }): React.JSX.Element {
  return (
    <div className={`exec-pill ${ok ? 'ok' : 'bad'}`}>
      <span className="exec-dot" aria-hidden="true" />
      <span className="exec-label">{label}</span>
      <span className="exec-value">{value}</span>
    </div>
  )
}

function Icon({ name }: { name: IconName }): React.JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'book':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21Z" />
          <path d="M5 5.5V21" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
        </svg>
      )
    case 'kindle':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M10 6.5h4" />
          <path d="M9.5 17h5" />
        </svg>
      )
    case 'login':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M20 6v5h-5" />
          <path d="M4 18v-5h5" />
          <path d="M7.5 8A7 7 0 0 1 20 11" />
          <path d="M16.5 16A7 7 0 0 1 4 13" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.8-1L14.5 3h-5l-.2 2.9a7.6 7.6 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.8 1l.2 2.9h5l.2-2.9a7.6 7.6 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
        </svg>
      )
    case 'stethoscope':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 4v5a4 4 0 0 0 8 0V4" />
          <path d="M8 4H6" />
          <path d="M16 4h2" />
          <path d="M12 13v3a4 4 0 0 0 8 0a2 2 0 1 0-4 0" />
        </svg>
      )
    case 'save':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 4h11l3 3v13H5Z" />
          <path d="M8 4v5h7V4" />
          <path d="M8 20v-6h8v6" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 3h6" />
          <path d="M7 7l1 13h8l1-13" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} aria-hidden="true">
          <path d="m8 5 10 7-10 7Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="5.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'github':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      )
  }
}

function ActionButton({
  children,
  className,
  icon,
  iconOnly = false,
  type = 'button',
  ...props
}: ActionButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`ui-button ${iconOnly ? 'icon-only' : ''} ${className ?? ''}`.trim()}
      {...props}
    >
      <span className="button-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      {children ? <span className="button-label">{children}</span> : null}
    </button>
  )
}

export default function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [kindle, setKindle] = useState<KindleStatus | null>(null)
  const [kindleScript, setKindleScript] = useState<KindleScriptStatus | null>(null)
  const [backendState, setBackendState] = useState<BackendState>('checking')
  const [lastRender, setLastRender] = useState<string | null>(null)
  const [nav, setNav] = useState<NavKey>('configuracoes')
  const [kindleTab, setKindleTab] = useState<KindleTab>('config')
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [checkingKindle, setCheckingKindle] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [scriptAction, setScriptAction] = useState<KindleScriptAction | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noticeNav, setNoticeNav] = useState<NavKey | null>(null)
  const [installOutput, setInstallOutput] = useState<string | null>(null)

  const configured = config?.setupComplete === true
  const activeLanguage = resolveLanguage(config?.language, runtime?.systemLanguage)
  const t = useCallback((key: string, vars?: Record<string, string>) => {
    const template = COPY[activeLanguage][key] ?? COPY.en[key] ?? key
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => vars?.[name] ?? '')
  }, [activeLanguage])

  const checkBackend = useCallback(async (baseUrl: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/ping`, { cache: 'no-store' })
      setBackendState(response.ok ? 'online' : 'offline')
    } catch {
      setBackendState('offline')
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    setCheckingAuth(true)
    try {
      const status = await window.dashboard.checkAuth()
      setAuth(status)
      return status
    } catch (authError) {
      showError('logins', authError instanceof Error ? authError.message : String(authError))
      return null
    } finally {
      setCheckingAuth(false)
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    let unsubscribeRender = (): void => {}
    let unsubscribeSettings = (): void => {}
    let unsubscribePanel = (): void => {}

    async function hydrate(): Promise<void> {
      try {
        const [runtimeInfo, savedConfig, authStatus] = await Promise.all([
          window.dashboard.getRuntimeInfo(),
          window.dashboard.getConfig(),
          window.dashboard.checkAuth(),
        ])

        setRuntime(runtimeInfo)
        setConfig(savedConfig)
        setForm(formFromConfig(savedConfig))
        setAuth(authStatus)
        setNav(savedConfig.setupComplete ? 'painel' : 'configuracoes')
        setLastRender(runtimeInfo.lastRender?.updatedAt ?? null)
        if (runtimeInfo.lastRender) setPreviewKey(Date.parse(runtimeInfo.lastRender.updatedAt) || Date.now())
        void checkBackend(runtimeInfo.baseUrl)
        timer = window.setInterval(() => void checkBackend(runtimeInfo.baseUrl), 5000)
      } catch (hydrateError) {
        setBackendState('offline')
        showError('configuracoes', hydrateError instanceof Error ? hydrateError.message : String(hydrateError))
      }
    }

    void hydrate()

    unsubscribeRender = window.dashboard.onRenderCompleted((result: RenderResult) => {
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
      if (noticeNav === 'painel') clearNotice('painel')
    })
    unsubscribeSettings = window.dashboard.onOpenSettings(() => {
      setNav('kindle')
      setKindleTab('config')
    })
    unsubscribePanel = window.dashboard.onOpenPanel(() => {
      setNav(configured ? 'painel' : 'configuracoes')
    })

    return () => {
      if (timer) window.clearInterval(timer)
      unsubscribeRender()
      unsubscribeSettings()
      unsubscribePanel()
    }
  }, [checkBackend, configured])

  const dashboardUrlPreview = useMemo(() => {
    if (!form?.dashboardUrl) return ''
    try {
      return new URL(form.dashboardUrl).toString()
    } catch {
      return form.dashboardUrl
    }
  }, [form?.dashboardUrl])

  const backendPill = useMemo(() => {
    if (backendState === 'offline') return { className: 'offline', label: t('backendOffline') }
    if (backendState === 'online' && !configured) return { className: 'pending', label: t('backendPending') }
    if (backendState === 'online') return { className: 'online', label: t('backendOnline') }
    return { className: 'checking', label: t('backendChecking') }
  }, [backendState, configured, t])

  const navItems = useMemo<NavItem[]>(() => [
    { key: 'painel', label: t('menuDashboard'), hint: t('hintDashboard'), icon: 'book' },
    { key: 'kindle', label: t('menuKindle'), hint: t('hintKindle'), icon: 'kindle' },
    { key: 'logins', label: t('menuLogins'), hint: t('hintLogins'), icon: 'login' },
    { key: 'configuracoes', label: t('menuSettings'), hint: t('hintSettings'), icon: 'settings' },
  ], [t])

  const activeNav = navItems.find((item) => item.key === nav) ?? navItems[0]

  function showMessage(nextNav: NavKey, value: string): void {
    setNoticeNav(nextNav)
    setMessage(value)
    setError(null)
  }

  function showError(nextNav: NavKey, value: string): void {
    setNoticeNav(nextNav)
    setError(value)
    setMessage(null)
  }

  function clearNotice(nextNav?: NavKey): void {
    setNoticeNav(nextNav ?? null)
    setMessage(null)
    setError(null)
  }

  function updateForm<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]): void {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveCurrentConfig(): Promise<DashboardConfig | null> {
    if (!form) return null

    setSaving(true)
    clearNotice('kindle')
    try {
      const saved = await window.dashboard.saveConfig(inputFromForm(form))
      setConfig(saved)
      setForm(formFromConfig(saved))
      showMessage('kindle', t('configSaved'))
      return saved
    } catch (saveError) {
      showError('kindle', saveError instanceof Error ? saveError.message : String(saveError))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveLanguage(language: LanguagePreference): Promise<void> {
    setSavingLanguage(true)
    clearNotice('configuracoes')
    try {
      const saved = await window.dashboard.setLanguage(language)
      setConfig(saved)
      showMessage('configuracoes', COPY[resolveLanguage(saved.language, runtime?.systemLanguage)].languageSaved)
    } catch (languageError) {
      showError('configuracoes', languageError instanceof Error ? languageError.message : String(languageError))
    } finally {
      setSavingLanguage(false)
    }
  }

  async function handleCheckKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setCheckingKindle(true)
    clearNotice('kindle')
    try {
      const status = await window.dashboard.checkKindle()
      setKindle(status)
      showMessage('kindle', status.detail)
      if (status.connected) {
        const scriptStatus = await window.dashboard.getKindleScriptStatus()
        setKindleScript(scriptStatus)
        setInstallOutput(scriptStatus.output)
      }
      setNav('kindle')
    } catch (kindleError) {
      showError('kindle', kindleError instanceof Error ? kindleError.message : String(kindleError))
    } finally {
      setCheckingKindle(false)
    }
  }

  async function handleInstallKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setInstalling(true)
    clearNotice('kindle')
    setInstallOutput(null)
    try {
      const result = await window.dashboard.installKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      showMessage('kindle', t('scriptsInstalled'))
      setNav('painel')
      await refreshAuth()
    } catch (installError) {
      showError('kindle', installError instanceof Error ? installError.message : String(installError))
    } finally {
      setInstalling(false)
    }
  }

  async function handleUninstallKindle(): Promise<void> {
    const confirmed = window.confirm(t('uninstallConfirm'))
    if (!confirmed) return

    const saved = await saveCurrentConfig()
    if (!saved) return

    setUninstalling(true)
    clearNotice('kindle')
    setInstallOutput(null)
    try {
      const result = await window.dashboard.uninstallKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      showMessage('kindle', t('scriptsRemoved'))
    } catch (uninstallError) {
      showError('kindle', uninstallError instanceof Error ? uninstallError.message : String(uninstallError))
    } finally {
      setUninstalling(false)
    }
  }

  async function handleKindleScript(action: 'start' | 'stop'): Promise<void> {
    setScriptAction(action)
    clearNotice('kindle')
    try {
      const status = action === 'start'
        ? await window.dashboard.startKindleScript()
        : await window.dashboard.stopKindleScript()
      setKindleScript(status)
      setInstallOutput(status.output)
      showMessage('kindle', action === 'start' ? t('scriptStarted') : t('scriptStopped'))
    } catch (scriptError) {
      showError('kindle', scriptError instanceof Error ? scriptError.message : String(scriptError))
    } finally {
      setScriptAction(null)
    }
  }

  async function handleRender(): Promise<void> {
    setRendering(true)
    clearNotice('painel')
    try {
      const result = await window.dashboard.renderNow()
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
    } catch (renderError) {
      showError('painel', renderError instanceof Error ? renderError.message : String(renderError))
    } finally {
      setRendering(false)
    }
  }

  async function handleOpenLogin(tool: AuthLoginTool): Promise<void> {
    clearNotice('logins')
    try {
      await window.dashboard.openLogin(tool)
      showMessage('logins', tool === 'claude' ? t('sourceLoginOpenedClaude') : t('sourceLoginOpenedCodex'))
    } catch (loginError) {
      showError('logins', loginError instanceof Error ? loginError.message : String(loginError))
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="book" /></span>
          <strong className="brand-title">{t('panelBrandTitle')}</strong>
        </div>

        <nav className="nav">
          {navItems.map((item) => {
            const locked = item.key === 'painel' && !configured
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${nav === item.key ? 'active' : ''}`}
                onClick={() => setNav(item.key)}
                disabled={locked}
                title={locked ? t('configureKindleFirst') : item.hint}
              >
                <span className="nav-icon" aria-hidden="true"><Icon name={item.icon} /></span>
                <span className="nav-text">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-hint">{item.hint}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className={`backend-pill ${backendPill.className}`}>
            <span className="status-dot" aria-hidden="true" />
            {backendPill.label}
          </div>
          <div className="about-line">
            <span>v{runtime?.appVersion ?? '1.0'} ({runtime?.appCommit ?? 'build'})</span>
            <span className="author-row">
              <span>Alex Ishida</span>
              <ActionButton
                className="icon-link"
                title={t('githubOpen')}
                aria-label={t('githubOpen')}
                onClick={() => void window.dashboard.openRepo()}
                icon="github"
                iconOnly
              />
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">{activeNav.hint}</p>
            <h1>{activeNav.label}</h1>
          </div>

          {nav === 'painel' ? (
            <>
              <div className="topbar-meta">
                <span className="meta-item">
                  <span className="meta-key">{t('lastImage')}</span>
                  <span className="meta-val">{formatTime(lastRender, activeLanguage, t('loading'))}</span>
                </span>
              </div>

              <div className="actions">
                <ActionButton icon="refresh" onClick={() => void handleRender()} disabled={rendering || !runtime}>
                  {rendering ? t('refreshNowBusy') : t('refreshNow')}
                </ActionButton>
              </div>
            </>
          ) : null}
        </header>

        <main className="content">
          {(message || error) && noticeNav === nav ? (
            <section className="global-notices">
              {message ? <div className="notice ok">{message}</div> : null}
              {error ? <div className="notice error">{error}</div> : null}
            </section>
          ) : null}

          {nav === 'painel' && configured ? (
            <section className="dashboard-grid">
              <section className="preview-wrap">
                <section className="preview-panel">
                  {runtime ? (
                    <PreviewFrame baseUrl={runtime.baseUrl} language={activeLanguage} previewKey={previewKey} />
                  ) : (
                    <div className="loading">{t('appLoading')}</div>
                  )}
                </section>
              </section>
            </section>
          ) : null}

          {nav === 'configuracoes' ? (
            <section className="single-grid settings-stack">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{t('languageSectionEyebrow')}</p>
                    <h2>{t('languageSectionTitle')}</h2>
                  </div>
                </div>

                <label className="wide-field">
                  <span>{t('languageField')}</span>
                  <select
                    value={config?.language ?? 'system'}
                    onChange={(event) => void handleSaveLanguage(event.target.value as LanguagePreference)}
                    disabled={savingLanguage || !config}
                  >
                    <option value="system">{t('languageAuto')}</option>
                    <option value="en">English</option>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="es">Español</option>
                  </select>
                </label>

                <p className="field-note standalone-note">
                  {t('languageDetected', {
                    value: runtime?.systemLanguage === 'pt-BR'
                      ? 'Português (Brasil)'
                      : runtime?.systemLanguage === 'es'
                        ? 'Español'
                        : 'English',
                  })}
                </p>
              </section>

            </section>
          ) : null}

          {nav === 'kindle' ? (
            <section className="single-grid">
              <div className="subtabs" role="tablist">
                <ActionButton
                  role="tab"
                  aria-selected={kindleTab === 'config'}
                  className={`subtab ${kindleTab === 'config' ? 'active' : ''}`}
                  onClick={() => setKindleTab('config')}
                  icon="settings"
                >
                  {t('configSectionTitle')}
                </ActionButton>
                <ActionButton
                  role="tab"
                  aria-selected={kindleTab === 'diagnostico'}
                  className={`subtab ${kindleTab === 'diagnostico' ? 'active' : ''}`}
                  onClick={() => setKindleTab('diagnostico')}
                  icon="stethoscope"
                >
                  {t('diagnosticsInstall')}
                </ActionButton>
              </div>

              {kindleTab === 'config' ? (
                <form className="panel settings-form" onSubmit={(event) => {
                  event.preventDefault()
                  void saveCurrentConfig()
                }}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{t('configSectionEyebrow')}</p>
                      <h2>{t('configSectionTitle')}</h2>
                    </div>
                    <span className={`badge ${configured ? 'ok' : 'warn'}`}>
                      {configured ? t('configBadgeReady') : t('configBadgePending')}
                    </span>
                  </div>

                  <div className="field-grid">
                    <label>
                      <span>{t('fieldKindleIp')}</span>
                      <input
                        value={form?.kindleIp ?? ''}
                        onChange={(event) => updateForm('kindleIp', event.target.value)}
                        placeholder={t('fieldKindleIpPlaceholder')}
                      />
                    </label>
                    <label>
                      <span>{t('fieldPort')}</span>
                      <input value={form?.kindlePort ?? ''} onChange={(event) => updateForm('kindlePort', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>{t('fieldUser')}</span>
                      <input value={form?.kindleUser ?? ''} onChange={(event) => updateForm('kindleUser', event.target.value)} />
                    </label>
                    <label>
                      <span>{t('fieldPassword')}</span>
                      <input
                        value={form?.kindlePassword ?? ''}
                        onChange={(event) => updateForm('kindlePassword', event.target.value)}
                        placeholder={config?.kindlePasswordSaved ? t('fieldPasswordSaved') : t('fieldPasswordPlaceholder')}
                        type="password"
                      />
                    </label>
                  </div>

                  <label className="wide-field">
                    <span>{t('dashboardHost')}</span>
                    <input
                      value={dashboardHostFromUrl(form?.dashboardUrl ?? '')}
                      onChange={(event) => updateForm('dashboardUrl', dashboardUrlWithHost(form?.dashboardUrl ?? '', event.target.value))}
                      placeholder={t('dashboardHostPlaceholder')}
                    />
                    <small className="field-note">{t('dashboardGeneratedUrl', { value: dashboardUrlPreview || t('loading') })}</small>
                  </label>

                  <div className="field-grid compact">
                    <label>
                      <span>{t('downloadInterval')}</span>
                      <input value={form?.kindleRefreshInterval ?? ''} onChange={(event) => updateForm('kindleRefreshInterval', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>{t('fullRefresh')}</span>
                      <input value={form?.kindleFullRefreshEvery ?? ''} onChange={(event) => updateForm('kindleFullRefreshEvery', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>{t('fieldWifiRetry')}</span>
                      <input value={form?.kindleWifiRetryEvery ?? ''} onChange={(event) => updateForm('kindleWifiRetryEvery', event.target.value)} inputMode="numeric" />
                    </label>
                  </div>

                  <div className="button-row">
                    <ActionButton type="submit" icon="save" disabled={saving}>{saving ? t('saving') : t('save')}</ActionButton>
                  </div>
                </form>
              ) : null}

              {kindleTab === 'diagnostico' ? (
                <section className="diag">
                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">1</span>
                      <div className="step-info">
                        <h2>{t('step1Title')}</h2>
                        <p className="step-sub">{t('step1Sub')}</p>
                      </div>
                      <ActionButton className="ghost" icon="search" onClick={() => void handleCheckKindle()} disabled={checkingKindle || saving}>
                        {checkingKindle ? t('checkingKindle') : t('checkKindle')}
                      </ActionButton>
                    </header>

                    {kindle ? (
                      <>
                        <div className={`conn-banner ${kindle.connected ? 'ok' : 'bad'}`}>
                          <span className="conn-dot" aria-hidden="true" />
                          <div className="conn-text">
                            <strong>{kindle.connected ? t('connectionReady') : t('connectionFail')}</strong>
                            <span>{kindle.detail}{kindle.model ? ` · ${kindle.model}` : ''}</span>
                          </div>
                        </div>
                        <div className="req-grid">
                          <ReqChip ok={kindle.jailbroken} label="Jailbreak" desc={t('reqJailbreak')} />
                          <ReqChip ok={kindle.fbink} label="FBInk" desc={t('reqFbink')} />
                          <ReqChip ok={kindle.hotfix} label="Hotfix" desc={t('reqHotfix')} />
                          <ReqChip ok={kindle.canInstall} label={t('configBadgeReady')} desc={t('reqReady')} />
                        </div>
                      </>
                    ) : (
                      <p className="step-empty">{t('diagnosticEmpty')}</p>
                    )}
                  </section>

                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">2</span>
                      <div className="step-info">
                        <h2>{t('step2Title')}</h2>
                        <p className="step-sub">{t('step2Sub')}</p>
                      </div>
                      {kindleScript ? (
                        <span className={`badge ${kindleScript.installed ? 'ok' : 'warn'}`}>
                          {kindleScript.installed ? t('installed') : t('statusInstalledMissing')}
                        </span>
                      ) : null}
                    </header>

                    <div className="button-row">
                      <ActionButton icon="download" onClick={() => void handleInstallKindle()} disabled={saving || installing || uninstalling || checkingKindle || scriptAction !== null}>
                        {installing ? t('installing') : t('installScripts')}
                      </ActionButton>
                      <ActionButton className="ghost danger" icon="trash" onClick={() => void handleUninstallKindle()} disabled={saving || installing || uninstalling || checkingKindle || scriptAction !== null}>
                        {uninstalling ? t('uninstallBusy') : t('uninstall')}
                      </ActionButton>
                    </div>
                  </section>

                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">3</span>
                      <div className="step-info">
                        <h2>{t('step3Title')}</h2>
                        <p className="step-sub">{t('step3Sub')}</p>
                      </div>
                    </header>

                    {kindleScript ? (
                      <div className="exec-grid">
                        <ExecPill ok={kindleScript.running} label={t('loop')} value={kindleScript.running ? t('loopRunning') : t('loopStopped')} />
                        <ExecPill ok={kindleScript.enabled} label={t('autostart')} value={kindleScript.enabled ? t('autostartActive') : t('autostartInactive')} />
                        <ExecPill ok={kindleScript.backendReachable} label={t('backend')} value={kindleScript.backendReachable ? t('ok') : t('backendOffline')} />
                      </div>
                    ) : (
                      <p className="step-empty">{t('diagnosticScriptEmpty')}</p>
                    )}

                    <div className="button-row">
                      <ActionButton
                        icon="play"
                        onClick={() => void handleKindleScript('start')}
                        disabled={!kindleScript?.installed || kindleScript.running || scriptAction !== null || installing || uninstalling || checkingKindle}
                      >
                        {scriptAction === 'start' ? t('starting') : t('startScript')}
                      </ActionButton>
                      <ActionButton
                        className="ghost"
                        icon="stop"
                        onClick={() => void handleKindleScript('stop')}
                        disabled={!kindleScript?.running || scriptAction !== null || installing || uninstalling || checkingKindle}
                      >
                        {scriptAction === 'stop' ? t('stopping') : t('stopScript')}
                      </ActionButton>
                    </div>
                  </section>

                  {installOutput ? (
                    <details className="tech-log">
                      <summary>{t('detailsTechnical')}</summary>
                      <pre className="output-log">{installOutput}</pre>
                    </details>
                  ) : null}
                </section>
              ) : null}
            </section>
          ) : null}

          {nav === 'logins' ? (
            <section className="single-grid">
              <section className="panel diagnostics-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{t('authEyebrow')}</p>
                    <h2>{t('authTitle')}</h2>
                  </div>
                  <ActionButton className="ghost" icon="refresh" onClick={() => void refreshAuth()} disabled={checkingAuth}>
                    {checkingAuth ? t('authChecking') : t('authRecheck')}
                  </ActionButton>
                </div>

                <div className="status-list">
                  {auth?.sources.map((source) => {
                    const action = sourceAction(source)
                    return (
                      <div className="status-row" key={source.name}>
                        <span className={`badge ${source.ok ? 'ok' : 'warn'}`}>{source.ok ? t('ok') : t('action')}</span>
                        <div>
                          <strong>{source.label}</strong>
                          <p>{source.detail}</p>
                          {!source.ok && source.hint ? <small>{source.hint}</small> : null}
                        </div>
                        {action ? (
                          <ActionButton className="ghost" icon="login" onClick={() => void handleOpenLogin(action)}>
                            {t('loginButton')}
                          </ActionButton>
                        ) : null}
                      </div>
                    )
                  })}
                  {!auth ? <p className="muted">{t('authLoading')}</p> : null}
                </div>
              </section>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
