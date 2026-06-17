import { useCallback, useEffect, useMemo, useState } from 'react'
import PreviewFrame from './PreviewFrame'
import type {
  AuthLoginTool,
  AuthSourceStatus,
  AuthStatus,
  DashboardConfig,
  DashboardConfigInput,
  KindleStatus,
  RenderResult,
  RuntimeInfo,
} from '../../shared/types'

type BackendState = 'checking' | 'online' | 'offline'
type NavKey = 'painel' | 'kindle' | 'logins'
type KindleTab = 'config' | 'diagnostico'

interface NavItem {
  key: NavKey
  label: string
  hint: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'painel', label: 'Painel', hint: 'Previa e estado', icon: '▦' },
  { key: 'kindle', label: 'Kindle', hint: 'Conexao e scripts', icon: '⚙' },
  { key: 'logins', label: 'Logins', hint: 'Auth das fontes', icon: '◉' },
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
  return ok ? 'OK' : 'Acao'
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

export default function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [kindle, setKindle] = useState<KindleStatus | null>(null)
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
    return { className: 'checking', label: 'Backend verificando' }
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
      setMessage('Configuracao salva')
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
      'Desinstalar os scripts do Kindle? O autostart do dashboard sera removido do aparelho.',
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
      setMessage('Scripts desinstalados do Kindle')
    } catch (uninstallError) {
      setError(uninstallError instanceof Error ? uninstallError.message : String(uninstallError))
    } finally {
      setUninstalling(false)
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
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
              <button
                type="button"
                className="icon-link"
                title="Abrir repositorio no GitHub"
                aria-label="Abrir repositorio no GitHub"
                onClick={() => void window.dashboard.openRepo()}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                    0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                    -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                    .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
                    0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82
                    a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27
                    1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
                    0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                    0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8
                    c0-4.42-3.58-8-8-8Z" />
                </svg>
              </button>
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
                  <span className="meta-key">Ultima imagem</span>
                  <span className="meta-val">{formatTime(lastRender)}</span>
                </span>
              </div>

              <div className="actions">
                <button type="button" onClick={() => void handleRender()} disabled={rendering || !runtime}>
                  {rendering ? 'Atualizando...' : 'Atualizar agora'}
                </button>
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
                <button
                  type="button"
                  role="tab"
                  aria-selected={kindleTab === 'config'}
                  className={`subtab ${kindleTab === 'config' ? 'active' : ''}`}
                  onClick={() => setKindleTab('config')}
                >
                  Configuracao
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={kindleTab === 'diagnostico'}
                  className={`subtab ${kindleTab === 'diagnostico' ? 'active' : ''}`}
                  onClick={() => setKindleTab('diagnostico')}
                >
                  Diagnostico e Instalacao de Scripts
                </button>
              </div>

              {kindleTab === 'config' ? (
                <form className="panel settings-form" onSubmit={(event) => {
                  event.preventDefault()
                  void saveCurrentConfig()
                }}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Setup</p>
                      <h2>Configuracao do Kindle</h2>
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
                      <span>Usuario SSH</span>
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
                    <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>

                  {message ? <div className="notice ok">{message}</div> : null}
                  {error ? <div className="notice error">{error}</div> : null}
                </form>
              ) : null}

              {kindleTab === 'diagnostico' ? (
                <section className="panel diagnostics-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Kindle</p>
                      <h2>SSH, jailbreak e scripts</h2>
                    </div>
                    <button type="button" className="ghost" onClick={() => void handleCheckKindle()} disabled={checkingKindle || saving}>
                      {checkingKindle ? 'Verificando...' : 'Verificar Kindle'}
                    </button>
                  </div>

                  {kindle ? (
                    <div className="status-list">
                      <div className="status-row">
                        <span className={`badge ${kindle.connected ? 'ok' : 'warn'}`}>{statusLabel(kindle.connected)}</span>
                        <div>
                          <strong>SSH {kindle.model ? `· ${kindle.model}` : ''}</strong>
                          <p>{kindle.detail}</p>
                        </div>
                      </div>
                      <div className="check-grid">
                        <span className={kindle.jailbroken ? 'check ok' : 'check warn'}>Jailbreak</span>
                        <span className={kindle.fbink ? 'check ok' : 'check warn'}>FBInk</span>
                        <span className={kindle.hotfix ? 'check ok' : 'check warn'}>Hotfix</span>
                        <span className={kindle.canInstall ? 'check ok' : 'check warn'}>Instalavel</span>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">Depois do jailbreak, ative USBNetwork/KUAL e rode a verificacao por SSH.</p>
                  )}

                  <div className="scripts-section">
                    <div className="scripts-head">
                      <p className="eyebrow">Scripts</p>
                      <span className="scripts-hint">Instala ou remove o autostart do dashboard no Kindle.</span>
                    </div>
                    <div className="button-row">
                      <button type="button" onClick={() => void handleInstallKindle()} disabled={saving || installing || uninstalling || checkingKindle}>
                        {installing ? 'Instalando...' : 'Instalar scripts'}
                      </button>
                      <button type="button" className="ghost danger" onClick={() => void handleUninstallKindle()} disabled={saving || installing || uninstalling || checkingKindle}>
                        {uninstalling ? 'Desinstalando...' : 'Desinstalar Script'}
                      </button>
                    </div>
                  </div>

                  {installOutput ? <pre className="output-log">{installOutput}</pre> : null}
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
                    <p className="eyebrow">Diagnostico</p>
                    <h2>Login das fontes</h2>
                  </div>
                  <button type="button" className="ghost" onClick={() => void refreshAuth()} disabled={checkingAuth}>
                    {checkingAuth ? 'Checando...' : 'Reverificar'}
                  </button>
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
                          <button type="button" className="ghost" onClick={() => void handleOpenLogin(action)}>
                            Login
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                  {!auth ? <p className="muted">Carregando status de auth...</p> : null}
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
