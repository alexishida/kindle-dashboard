import { app, Menu, Notification } from 'electron'
import { getAuthStatus } from './auth'
import { startBackend, stopBackend } from './backend-bridge'
import { loadConfig } from './config'
import { applyLanguagePreference, loadLocales, text } from './i18n'
import { registerIpc } from './ipc'
import {
  destroyCaptureWindow,
  renderDashboard,
  scheduleRender,
  stopRenderTimer,
} from './render'
import { createTray, destroyTray } from './tray'
import {
  createMainWindow,
  destroyMainWindow,
  restoreMainWindow,
  setQuitting,
  showPanelWindow,
  showSettingsWindow,
} from './windows'

let quitInProgress: Promise<void> | null = null

async function shutdown(): Promise<void> {
  stopRenderTimer()
  destroyCaptureWindow()
  destroyMainWindow()
  destroyTray()
  await stopBackend()
}

function quitApplication(): void {
  if (quitInProgress) return

  setQuitting(true)
  quitInProgress = shutdown()
    .catch((error) => {
      console.error('shutdown failed', error)
    })
    .finally(() => {
      app.exit(0)
    })
}

function runStartupChecks(): void {
  const auth = getAuthStatus()
  if (auth.ok) return

  if (Notification.isSupported()) {
    new Notification({
      title: text('notificationTitle'),
      body: text('notificationBody'),
    }).show()
  }
  showSettingsWindow()
}

app.setName('kindle-dashboard')

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    restoreMainWindow()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.alexi.kindle-dashboard')
    Menu.setApplicationMenu(null)

    loadLocales()
    const config = await loadConfig()
    applyLanguagePreference(config.language)

    scheduleRender(config.kindleRefreshInterval)
    registerIpc({ quitApplication })
    await startBackend()
    createMainWindow({ showOnReady: !config.setupComplete })
    createTray({
      onOpenPanel: showPanelWindow,
      onOpenSettings: showSettingsWindow,
      onRefresh: () => {
        void renderDashboard()
      },
      onQuit: quitApplication,
    })
    await renderDashboard()
    if (config.setupComplete) runStartupChecks()
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    restoreMainWindow()
  })

  app.on('before-quit', () => {
    setQuitting(true)
  })

  app.on('will-quit', (event) => {
    if (quitInProgress) return
    event.preventDefault()
    quitApplication()
  })
}
