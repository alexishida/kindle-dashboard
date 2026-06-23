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
  RenderResult,
  RuntimeInfo,
} from '../../shared/types'

type BackendState = 'checking' | 'online' | 'offline'
type NavKey = 'painel' | 'kindle' | 'logins'
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

interface NavItem {
  key: NavKey
  label: string
  hint: string
  icon: IconName
}

const NAV_ITEMS: NavItem[] = [
  { key: 'painel', label: 'Painel', hint: 'Prévia e estado', icon: 'book' },
  { key: 'kindle', label: 'Kindle', hint: 'Conexão e scripts', icon: 'kindle' },
  { key: 'logins', label: 'Logins', hint: 'Autenticação das fontes', icon: 'login' },
]

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

function formatTime(value: string | null): string {
  if (!value) return 'aguardando'
  return new Date(value).toLocaleString('pt-BR', {
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

function statusLabel(ok: boolean): string {
  return ok ? 'OK' : 'Ação'
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
  const [nav, setNav] = useState<NavKey>('kindle')
  const [kindleTab, setKindleTab] = useState<KindleTab>('config')
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [checkingKindle, setCheckingKindle] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [scriptAction, setScriptAction] = useState<KindleScriptAction | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [installOutput, setInstallOutput] = useState<string | null>(null)

  const configured = config?.setupComplete === true

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
      setError(authError instanceof Error ? authError.message : String(authError))
      return null
    } finally {
      setCheckingAuth(false)
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    let unsubscribeRender = (): void => {}
    let unsubscribeSettings = (): void => {}

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
        setNav(savedConfig.setupComplete ? 'painel' : 'kindle')
        setLastRender(runtimeInfo.lastRender?.updatedAt ?? null)
        if (runtimeInfo.lastRender) setPreviewKey(Date.parse(runtimeInfo.lastRender.updatedAt) || Date.now())
        void checkBackend(runtimeInfo.baseUrl)
        timer = window.setInterval(() => void checkBackend(runtimeInfo.baseUrl), 5000)
      } catch (hydrateError) {
        setBackendState('offline')
        setError(hydrateError instanceof Error ? hydrateError.message : String(hydrateError))
      }
    }

    void hydrate()

    unsubscribeRender = window.dashboard.onRenderCompleted((result: RenderResult) => {
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
      setError(null)
    })
    unsubscribeSettings = window.dashboard.onOpenSettings(() => {
      setNav('kindle')
      setKindleTab('config')
    })

    return () => {
      if (timer) window.clearInterval(timer)
      unsubscribeRender()
      unsubscribeSettings()
    }
  }, [checkBackend])

  const authNeedsAction = useMemo(() => auth?.sources.filter((source) => !source.ok) ?? [], [auth])
  const dashboardUrlPreview = useMemo(() => {
    if (!form?.dashboardUrl) return ''
    try {
      return new URL(form.dashboardUrl).toString()
    } catch {
      return form.dashboardUrl
    }
  }, [form?.dashboardUrl])
  const backendPill = useMemo(() => {
    if (backendState === 'offline') return { className: 'offline', label: 'Backend offline' }
    if (backendState === 'online' && !configured) return { className: 'pending', label: 'Setup pendente' }
    if (backendState === 'online') return { className: 'online', label: 'Backend online' }
    return { className: 'checking', label: 'Verificando backend' }
  }, [backendState, configured])

  function updateForm<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]): void {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveCurrentConfig(): Promise<DashboardConfig | null> {
    if (!form) return null

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await window.dashboard.saveConfig(inputFromForm(form))
      setConfig(saved)
      setForm(formFromConfig(saved))
      setMessage('Configuração salva')
      return saved
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setCheckingKindle(true)
    setError(null)
    setMessage(null)
    try {
      const status = await window.dashboard.checkKindle()
      setKindle(status)
      setMessage(status.detail)
      if (status.connected) {
        const scriptStatus = await window.dashboard.getKindleScriptStatus()
        setKindleScript(scriptStatus)
        setInstallOutput(scriptStatus.output)
      }
      setNav('kindle')
      setKindleTab('diagnostico')
    } catch (kindleError) {
      setError(kindleError instanceof Error ? kindleError.message : String(kindleError))
    } finally {
      setCheckingKindle(false)
    }
  }

  async function handleInstallKindle(): Promise<void> {
    const saved = await saveCurrentConfig()
    if (!saved) return

    setInstalling(true)
    setError(null)
    setMessage(null)
    setInstallOutput(null)
    try {
      const result = await window.dashboard.installKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      setMessage('Scripts instalados no Kindle')
      setNav('painel')
      await refreshAuth()
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : String(installError))
    } finally {
      setInstalling(false)
    }
  }

  async function handleUninstallKindle(): Promise<void> {
    const confirmed = window.confirm(
      'Desinstalar os scripts do Kindle? O autostart do dashboard será removido do aparelho.',
    )
    if (!confirmed) return

    const saved = await saveCurrentConfig()
    if (!saved) return

    setUninstalling(true)
    setError(null)
    setMessage(null)
    setInstallOutput(null)
    try {
      const result = await window.dashboard.uninstallKindle()
      setConfig(result.config)
      setForm(formFromConfig(result.config))
      setInstallOutput(result.output)
      setKindleScript(result.status)
      setMessage('Scripts desinstalados do Kindle')
    } catch (uninstallError) {
      setError(uninstallError instanceof Error ? uninstallError.message : String(uninstallError))
    } finally {
      setUninstalling(false)
    }
  }

  async function handleKindleScript(action: 'start' | 'stop'): Promise<void> {
    setScriptAction(action)
    setError(null)
    setMessage(null)
    try {
      const status = action === 'start'
        ? await window.dashboard.startKindleScript()
        : await window.dashboard.stopKindleScript()
      setKindleScript(status)
      setInstallOutput(status.output)
      setMessage(action === 'start' ? 'Script iniciado no Kindle' : 'Script parado no Kindle')
    } catch (scriptError) {
      setError(scriptError instanceof Error ? scriptError.message : String(scriptError))
    } finally {
      setScriptAction(null)
    }
  }

  async function handleRender(): Promise<void> {
    setRendering(true)
    setError(null)
    try {
      const result = await window.dashboard.renderNow()
      setLastRender(result.updatedAt)
      setPreviewKey(Date.now())
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError))
    } finally {
      setRendering(false)
    }
  }

  async function handleOpenLogin(tool: AuthLoginTool): Promise<void> {
    setError(null)
    try {
      await window.dashboard.openLogin(tool)
      setMessage(tool === 'claude' ? 'Janela de login do Claude aberta' : 'Janela de login do Codex aberta')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError))
    }
  }

  const activeNav = NAV_ITEMS.find((item) => item.key === nav) ?? NAV_ITEMS[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <div>
            <p className="brand-eyebrow">Kindle Paperwhite</p>
            <strong className="brand-title">Dashboard</strong>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            const locked = item.key === 'painel' && !configured
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${nav === item.key ? 'active' : ''}`}
                onClick={() => setNav(item.key)}
                disabled={locked}
                title={locked ? 'Configure o Kindle primeiro' : item.hint}
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
                title="Abrir repositório no GitHub"
                aria-label="Abrir repositório no GitHub"
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
                  <span className="meta-key">Última imagem</span>
                  <span className="meta-val">{formatTime(lastRender)}</span>
                </span>
              </div>

              <div className="actions">
                <ActionButton icon="refresh" onClick={() => void handleRender()} disabled={rendering || !runtime}>
                  {rendering ? 'Atualizando...' : 'Atualizar agora'}
                </ActionButton>
              </div>
            </>
          ) : null}
        </header>

        <main className="content">
          {nav === 'painel' && configured ? (
            <section className="dashboard-grid">
              <section className="preview-wrap">
                <section className="preview-panel">
                  {runtime ? (
                    <PreviewFrame baseUrl={runtime.baseUrl} previewKey={previewKey} />
                  ) : (
                    <div className="loading">Iniciando o dashboard...</div>
                  )}
                </section>
                {error ? <div className="notice error preview-error">{error}</div> : null}
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
                  Configuração
                </ActionButton>
                <ActionButton
                  role="tab"
                  aria-selected={kindleTab === 'diagnostico'}
                  className={`subtab ${kindleTab === 'diagnostico' ? 'active' : ''}`}
                  onClick={() => setKindleTab('diagnostico')}
                  icon="stethoscope"
                >
                  Diagnóstico e Instalação de Scripts
                </ActionButton>
              </div>

              {kindleTab === 'config' ? (
                <form className="panel settings-form" onSubmit={(event) => {
                  event.preventDefault()
                  void saveCurrentConfig()
                }}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Setup</p>
                      <h2>Configuração do Kindle</h2>
                    </div>
                    <span className={`badge ${configured ? 'ok' : 'warn'}`}>{configured ? 'Pronto' : 'Pendente'}</span>
                  </div>

                  <div className="field-grid">
                    <label>
                      <span>IP do Kindle</span>
                      <input value={form?.kindleIp ?? ''} onChange={(event) => updateForm('kindleIp', event.target.value)} placeholder="ex.: IP do Kindle" />
                    </label>
                    <label>
                      <span>Porta SSH</span>
                      <input value={form?.kindlePort ?? ''} onChange={(event) => updateForm('kindlePort', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>Usuário SSH</span>
                      <input value={form?.kindleUser ?? ''} onChange={(event) => updateForm('kindleUser', event.target.value)} />
                    </label>
                    <label>
                      <span>Senha SSH</span>
                      <input
                        value={form?.kindlePassword ?? ''}
                        onChange={(event) => updateForm('kindlePassword', event.target.value)}
                        placeholder={config?.kindlePasswordSaved ? 'senha salva; preencha para trocar' : 'senha do Kindle'}
                        type="password"
                      />
                    </label>
                  </div>

                  <label className="wide-field">
                    <span>IP do PC</span>
                    <input
                      value={dashboardHostFromUrl(form?.dashboardUrl ?? '')}
                      onChange={(event) => updateForm('dashboardUrl', dashboardUrlWithHost(form?.dashboardUrl ?? '', event.target.value))}
                      placeholder="ex.: 192.168.0.10"
                    />
                    <small className="field-note">URL gerada: {dashboardUrlPreview || 'aguardando'}</small>
                  </label>

                  <div className="field-grid compact">
                    <label>
                      <span>Download Kindle (segundos)</span>
                      <input value={form?.kindleRefreshInterval ?? ''} onChange={(event) => updateForm('kindleRefreshInterval', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>Refresh completo (ciclos)</span>
                      <input value={form?.kindleFullRefreshEvery ?? ''} onChange={(event) => updateForm('kindleFullRefreshEvery', event.target.value)} inputMode="numeric" />
                    </label>
                    <label>
                      <span>Retry Wi-Fi (falhas seguidas)</span>
                      <input value={form?.kindleWifiRetryEvery ?? ''} onChange={(event) => updateForm('kindleWifiRetryEvery', event.target.value)} inputMode="numeric" />
                    </label>
                  </div>

                  <div className="button-row">
                    <ActionButton type="submit" icon="save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</ActionButton>
                  </div>

                  {message ? <div className="notice ok">{message}</div> : null}
                  {error ? <div className="notice error">{error}</div> : null}
                </form>
              ) : null}

              {kindleTab === 'diagnostico' ? (
                <section className="diag">
                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">1</span>
                      <div className="step-info">
                        <h2>Conectar e verificar</h2>
                        <p className="step-sub">Confere SSH, jailbreak e ferramentas no aparelho.</p>
                      </div>
                      <ActionButton className="ghost" icon="search" onClick={() => void handleCheckKindle()} disabled={checkingKindle || saving}>
                        {checkingKindle ? 'Verificando...' : 'Verificar Kindle'}
                      </ActionButton>
                    </header>

                    {kindle ? (
                      <>
                        <div className={`conn-banner ${kindle.connected ? 'ok' : 'bad'}`}>
                          <span className="conn-dot" aria-hidden="true" />
                          <div className="conn-text">
                            <strong>{kindle.connected ? 'Kindle conectado' : 'Kindle não encontrado'}</strong>
                            <span>{kindle.detail}{kindle.model ? ` · ${kindle.model}` : ''}</span>
                          </div>
                        </div>
                        <div className="req-grid">
                          <ReqChip ok={kindle.jailbroken} label="Jailbreak" desc="Acesso root liberado" />
                          <ReqChip ok={kindle.fbink} label="FBInk" desc="Mostra a imagem na tela" />
                          <ReqChip ok={kindle.hotfix} label="Hotfix" desc="Correção de inicialização" />
                          <ReqChip ok={kindle.canInstall} label="Pronto" desc="Pode instalar os scripts" />
                        </div>
                      </>
                    ) : (
                      <p className="step-empty">Depois do jailbreak, ative USBNetwork/KUAL e toque em <strong>Verificar Kindle</strong>.</p>
                    )}
                  </section>

                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">2</span>
                      <div className="step-info">
                        <h2>Instalar scripts</h2>
                        <p className="step-sub">Coloca o autostart do dashboard no Kindle.</p>
                      </div>
                      {kindleScript ? (
                        <span className={`badge ${kindleScript.installed ? 'ok' : 'warn'}`}>
                          {kindleScript.installed ? 'Instalado' : 'Ausente'}
                        </span>
                      ) : null}
                    </header>
                    <div className="button-row">
                      <ActionButton icon="download" onClick={() => void handleInstallKindle()} disabled={saving || installing || uninstalling || checkingKindle || scriptAction !== null}>
                        {installing ? 'Instalando...' : 'Instalar scripts'}
                      </ActionButton>
                      <ActionButton className="ghost danger" icon="trash" onClick={() => void handleUninstallKindle()} disabled={saving || installing || uninstalling || checkingKindle || scriptAction !== null}>
                        {uninstalling ? 'Desinstalando...' : 'Desinstalar'}
                      </ActionButton>
                    </div>
                  </section>

                  <section className="panel diag-step">
                    <header className="step-head">
                      <span className="step-num" aria-hidden="true">3</span>
                      <div className="step-info">
                        <h2>Executar no Kindle</h2>
                        <p className="step-sub">Liga ou desliga o loop que atualiza a tela.</p>
                      </div>
                    </header>

                    {kindleScript ? (
                      <div className="exec-grid">
                        <ExecPill ok={kindleScript.running} label="Loop" value={kindleScript.running ? 'Rodando' : 'Parado'} />
                        <ExecPill ok={kindleScript.enabled} label="Autostart" value={kindleScript.enabled ? 'Ativo' : 'Inativo'} />
                        <ExecPill ok={kindleScript.backendReachable} label="Backend" value={kindleScript.backendReachable ? 'Acessível' : 'Indisponível'} />
                      </div>
                    ) : (
                      <p className="step-empty">Verifique o Kindle para ver o estado do script.</p>
                    )}

                    <div className="button-row">
                      <ActionButton
                        icon="play"
                        onClick={() => void handleKindleScript('start')}
                        disabled={!kindleScript?.installed || kindleScript.running || scriptAction !== null || installing || uninstalling || checkingKindle}
                      >
                        {scriptAction === 'start' ? 'Iniciando...' : 'Iniciar script'}
                      </ActionButton>
                      <ActionButton
                        className="ghost"
                        icon="stop"
                        onClick={() => void handleKindleScript('stop')}
                        disabled={!kindleScript?.running || scriptAction !== null || installing || uninstalling || checkingKindle}
                      >
                        {scriptAction === 'stop' ? 'Parando...' : 'Parar script'}
                      </ActionButton>
                    </div>
                  </section>

                  {installOutput ? (
                    <details className="tech-log">
                      <summary>Detalhes técnicos</summary>
                      <pre className="output-log">{installOutput}</pre>
                    </details>
                  ) : null}
                  {message ? <div className="notice ok">{message}</div> : null}
                  {error ? <div className="notice error">{error}</div> : null}
                </section>
              ) : null}
            </section>
          ) : null}

          {nav === 'logins' ? (
            <section className="single-grid">
              <section className="panel diagnostics-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Diagnóstico</p>
                    <h2>Login das fontes</h2>
                  </div>
                  <ActionButton className="ghost" icon="refresh" onClick={() => void refreshAuth()} disabled={checkingAuth}>
                    {checkingAuth ? 'Checando...' : 'Reverificar'}
                  </ActionButton>
                </div>

                <div className="status-list">
                  {auth?.sources.map((source) => {
                    const action = sourceAction(source)
                    return (
                      <div className="status-row" key={source.name}>
                        <span className={`badge ${source.ok ? 'ok' : 'warn'}`}>{statusLabel(source.ok)}</span>
                        <div>
                          <strong>{source.label}</strong>
                          <p>{source.detail}</p>
                          {!source.ok && source.hint ? <small>{source.hint}</small> : null}
                        </div>
                        {action ? (
                          <ActionButton className="ghost" icon="login" onClick={() => void handleOpenLogin(action)}>
                            Login
                          </ActionButton>
                        ) : null}
                      </div>
                    )
                  })}
                  {!auth ? <p className="muted">Carregando status de autenticação...</p> : null}
                </div>

                {message ? <div className="notice ok">{message}</div> : null}
                {error ? <div className="notice error">{error}</div> : null}
              </section>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
