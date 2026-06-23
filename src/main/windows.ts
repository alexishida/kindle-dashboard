import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { appAssetPath } from './paths'

let mainWindow: BrowserWindow | null = null
let quitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setQuitting(value: boolean): void {
  quitting = value
}

export function secureWindow(window: BrowserWindow, allowedOrigin: string): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedOrigin)) event.preventDefault()
  })
}

function sendToRenderer(channel: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const send = (): void => {
    mainWindow?.webContents.send(channel)
  }

  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send)
  else send()
}

export function createMainWindow(options: { showOnReady: boolean } = { showOnReady: true }): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 930,
    minWidth: 980,
    minHeight: 720,
    show: false,
    title: `Kindle Dashboard v${app.getVersion()}`,
    icon: appAssetPath('icon.png'),
    backgroundColor: '#e9e5dc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  const allowedOrigin = rendererUrl ? new URL(rendererUrl).origin : 'file://'
  secureWindow(window, allowedOrigin)

  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    mainWindow = null
  })
  window.once('ready-to-show', () => {
    if (options.showOnReady) window.show()
  })
  window.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  window.setMenuBarVisibility(false)
  window.setMenu(null)

  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = window
  return window
}

export function restoreMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow({ showOnReady: true })
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function showSettingsWindow(): void {
  restoreMainWindow()
  sendToRenderer('settings:open')
}

export function showPanelWindow(): void {
  restoreMainWindow()
  sendToRenderer('panel:open')
}

export function destroyMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  mainWindow = null
}
