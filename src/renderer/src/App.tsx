import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTranslator } from './i18n'
import { formFromConfig, inputFromForm, resolveLanguage } from './lib/format'
import type {
  BackendState,
  ConfigForm,
  KindleScriptAction,
  KindleTab,
  NavItem,
  NavKey,
} from './types'
import { KindleView } from './views/KindleView'
import { LoginsView } from './views/LoginsView'
import { PanelView } from './views/PanelView'
import { SettingsView } from './views/SettingsView'
import { Sidebar } from './views/Sidebar'
import { Topbar } from './views/Topbar'
import type {
  AuthLoginTool,
  AuthStatus,
  DashboardConfig,
  KindleScriptStatus,
  KindleStatus,
  LanguagePreference,
  RenderResult,
  RuntimeInfo,
} from '../../shared/types'

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
  const t = useMemo(() => createTranslator(activeLanguage), [activeLanguage])

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

  function updateForm(key: keyof ConfigForm, value: string): void {
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
      const savedTranslator = createTranslator(resolveLanguage(saved.language, runtime?.systemLanguage))
      showMessage('configuracoes', savedTranslator('languageSaved'))
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

  async function handleKindleScript(action: KindleScriptAction): Promise<void> {
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
      <Sidebar
        appCommit={runtime?.appCommit}
        appVersion={runtime?.appVersion}
        backendPill={backendPill}
        configured={configured}
        nav={nav}
        navItems={navItems}
        onNav={setNav}
        onOpenRepo={() => void window.dashboard.openRepo()}
        t={t}
      />

      <div className="main">
        <Topbar
          activeNav={activeNav}
          canRender={Boolean(runtime)}
          language={activeLanguage}
          lastRender={lastRender}
          nav={nav}
          onRender={() => void handleRender()}
          rendering={rendering}
          t={t}
        />

        <main className="content">
          {(message || error) && noticeNav === nav ? (
            <section className="global-notices">
              {message ? <div className="notice ok">{message}</div> : null}
              {error ? <div className="notice error">{error}</div> : null}
            </section>
          ) : null}

          {nav === 'painel' && configured ? (
            <PanelView baseUrl={runtime?.baseUrl} language={activeLanguage} previewKey={previewKey} t={t} />
          ) : null}

          {nav === 'configuracoes' ? (
            <SettingsView
              disabled={!config}
              languagePreference={config?.language ?? 'system'}
              onChangeLanguage={(language) => void handleSaveLanguage(language)}
              saving={savingLanguage}
              systemLanguage={runtime?.systemLanguage}
              t={t}
            />
          ) : null}

          {nav === 'kindle' ? (
            <KindleView
              checkingKindle={checkingKindle}
              config={config}
              configured={configured}
              dashboardUrlPreview={dashboardUrlPreview}
              form={form}
              installOutput={installOutput}
              installing={installing}
              kindle={kindle}
              kindleScript={kindleScript}
              kindleTab={kindleTab}
              onCheckKindle={() => void handleCheckKindle()}
              onInstall={() => void handleInstallKindle()}
              onKindleTab={setKindleTab}
              onScript={(action) => void handleKindleScript(action)}
              onSubmitConfig={() => void saveCurrentConfig()}
              onUninstall={() => void handleUninstallKindle()}
              onUpdateForm={updateForm}
              saving={saving}
              scriptAction={scriptAction}
              t={t}
              uninstalling={uninstalling}
            />
          ) : null}

          {nav === 'logins' ? (
            <LoginsView
              checking={checkingAuth}
              language={activeLanguage}
              onLogin={(tool) => void handleOpenLogin(tool)}
              onRecheck={() => void refreshAuth()}
              sources={auth?.sources}
              t={t}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
