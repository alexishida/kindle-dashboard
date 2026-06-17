import { useCallback, useEffect, useMemo, useState } from 'react'
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
type ViewMode = 'dashboard' | 'settings'

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

export default function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [kindle, setKindle] = useState<KindleStatus | null>(null)
  const [backendState, setBackendState] = useState<BackendState>('checking')
  const [lastRender, setLastRender] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('settings')
  const [rendering, setRendering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [checkingKindle, setCheckingKindle] = useState(false)
  const [installing, setInstalling] = useState(false)
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
        setView(savedConfig.setupComplete ? 'dashboard' : 'settings')
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
    unsubscribeSettings = window.dashboard.onOpenSettings(() => setView('settings'))

    return () => {
      if (timer) window.clearInterval(timer)
      unsubscribeRender()
      unsubscribeSettings()
    }
  }, [checkBackend])

  const authNeedsAction = useMemo(() => auth?.sources.filter((source) => !source.ok) ?? [], [auth])

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
      setView('dashboard')
      await refreshAuth()
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : String(installError))
    } finally {
      setInstalling(false)
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kindle Paperwhite</p>
          <h1>Kindle Dashboard</h1>
        </div>

        <div className="status-area">
          <span className={`status-dot ${backendState}`} aria-hidden="true" />
          <span>Backend {backendState === 'online' ? 'online' : backendState === 'offline' ? 'offline' : 'verificando'}</span>
          <span className="divider" />
          <span>Ultima imagem: {formatTime(lastRender)}</span>
          <span className="divider" />
          <span>{configured ? 'Configurado' : 'Primeiro uso'}</span>
        </div>

        <div className="actions">
          <button type="button" className="secondary" onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')} disabled={!configured}>
            {view === 'settings' ? 'Painel' : 'Configuracoes'}
          </button>
          <button type="button" onClick={() => void handleRender()} disabled={rendering || !runtime}>
            {rendering ? 'Atualizando...' : 'Atualizar agora'}
          </button>
          <button className="secondary" type="button" onClick={() => void window.dashboard.quit()}>
            Encerrar
          </button>
        </div>
      </header>

      {view === 'settings' || !configured ? (
        <section className="setup-grid">
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
              <span>URL do PNG para o Kindle</span>
              <input value={form?.dashboardUrl ?? ''} onChange={(event) => updateForm('dashboardUrl', event.target.value)} />
            </label>

            <div className="field-grid compact">
              <label>
                <span>Download Kindle</span>
                <input value={form?.kindleRefreshInterval ?? ''} onChange={(event) => updateForm('kindleRefreshInterval', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                <span>Refresh completo</span>
                <input value={form?.kindleFullRefreshEvery ?? ''} onChange={(event) => updateForm('kindleFullRefreshEvery', event.target.value)} inputMode="numeric" />
              </label>
              <label>
                <span>Retry Wi-Fi</span>
                <input value={form?.kindleWifiRetryEvery ?? ''} onChange={(event) => updateForm('kindleWifiRetryEvery', event.target.value)} inputMode="numeric" />
              </label>
            </div>

            <div className="button-row">
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="secondary" onClick={() => void handleCheckKindle()} disabled={saving || checkingKindle}>
                {checkingKindle ? 'Verificando...' : 'Verificar Kindle'}
              </button>
              <button type="button" onClick={() => void handleInstallKindle()} disabled={saving || installing}>
                {installing ? 'Instalando...' : 'Injetar scripts'}
              </button>
            </div>
          </form>

          <section className="panel diagnostics-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Diagnostico</p>
                <h2>Login e jailbreak</h2>
              </div>
              <button type="button" className="secondary" onClick={() => void refreshAuth()} disabled={checkingAuth}>
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
                      <button type="button" className="secondary" onClick={() => void handleOpenLogin(action)}>
                        Login
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="kindle-summary">
              <h3>Kindle</h3>
              {kindle ? (
                <div className="status-list">
                  <div className="status-row">
                    <span className={`badge ${kindle.connected ? 'ok' : 'warn'}`}>{statusLabel(kindle.connected)}</span>
                    <div>
                      <strong>SSH</strong>
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
            </div>

            {message ? <div className="notice ok">{message}</div> : null}
            {error ? <div className="notice error">{error}</div> : null}
            {installOutput ? <pre className="output-log">{installOutput}</pre> : null}
          </section>
        </section>
      ) : (
        <section className="dashboard-grid">
          <section className="preview-panel">
            {runtime ? (
              <iframe
                key={previewKey}
                title="Previa do dashboard"
                src={`${runtime.baseUrl}/render?desktop=1&preview=${previewKey}`}
              />
            ) : (
              <div className="loading">Iniciando o dashboard...</div>
            )}
          </section>

          <aside className="panel side-panel">
            <div>
              <p className="eyebrow">Operacao</p>
              <h2>Estado</h2>
            </div>
            <div className="metric">
              <span>Kindle</span>
              <strong>{config.kindleIp}:{config.kindlePort}</strong>
            </div>
            <div className="metric">
              <span>Auth</span>
              <strong>{auth?.ok ? 'OK' : `${authNeedsAction.length} acao`}</strong>
            </div>
            <div className="metric">
              <span>PNG</span>
              <strong title={runtime?.outputPath}>{runtime?.outputPath ?? 'preparando'}</strong>
            </div>
            <div className="button-column">
              <button type="button" onClick={() => setView('settings')}>Abrir configuracoes</button>
              <button type="button" className="secondary" onClick={() => void refreshAuth()} disabled={checkingAuth}>
                Reverificar logins
              </button>
            </div>
            {error ? <div className="notice error">{error}</div> : null}
          </aside>
        </section>
      )}

      <footer>
        <span>{runtime ? `Render a cada ${runtime.renderIntervalSeconds}s` : 'Preparando runtime'}</span>
        <span title={runtime?.imageUrl}>{runtime ? `Kindle busca: ${runtime.imageUrl}` : ''}</span>
      </footer>
    </main>
  )
}
