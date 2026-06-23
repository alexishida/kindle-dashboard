import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { currentConfig } from './config'
import { BASE_URL, LANDSCAPE_CAPTURE_HEIGHT, LANDSCAPE_CAPTURE_WIDTH } from './constants'
import { getActiveLanguage } from './i18n'
import { secureWindow } from './windows'

// Janela Picture-in-Picture: mostra o dashboard ao vivo numa janela pequena,
// sempre no topo, no PC. Reusa a mesma pagina `/render` do backend (modo
// `capture-landscape`), escalando o conteudo conforme o tamanho da janela.

const ASPECT = LANDSCAPE_CAPTURE_WIDTH / LANDSCAPE_CAPTURE_HEIGHT
const BASE_WIDTH = 460
const DEFAULT_SCALE = 1.5
const MIN_WIDTH = 280

let pipWindow: BrowserWindow | null = null
let resizeTimer: NodeJS.Timeout | null = null

function scaleForWidth(width: number): number {
  const scale = width / LANDSCAPE_CAPTURE_WIDTH
  if (!Number.isFinite(scale) || scale <= 0) return (BASE_WIDTH * DEFAULT_SCALE) / LANDSCAPE_CAPTURE_WIDTH
  return Math.min(1, Math.max(0.05, scale))
}

function pipUrl(width: number): string {
  const captureScale = scaleForWidth(width).toFixed(6)
  const lang = encodeURIComponent(getActiveLanguage())
  return `${BASE_URL}/render?pip=1&captureScale=${captureScale}&lang=${lang}&_=${Date.now()}`
}

// Atualiza so a escala (sem recarregar) quando o usuario redimensiona a janela.
function applyScale(width: number): void {
  if (!pipWindow || pipWindow.isDestroyed()) return
  const scale = scaleForWidth(width)
  pipWindow.webContents
    .executeJavaScript(`document.documentElement.style.setProperty('--capture-scale', '${scale}')`)
    .catch(() => {})
}

function pipScale(): number {
  const scale = currentConfig()?.pictureInPictureScale
  return typeof scale === 'number' && scale > 0 ? scale : DEFAULT_SCALE
}

// Largura inicial: base x escala das configuracoes, sem estourar a tela.
function defaultWidth(): number {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const fits = Math.min(BASE_WIDTH * pipScale(), width, Math.floor(height * ASPECT))
  return Math.max(MIN_WIDTH, Math.round(fits))
}

function openPipWindow(): void {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.show()
    pipWindow.focus()
    return
  }

  const initialWidth = defaultWidth()
  const window = new BrowserWindow({
    width: initialWidth,
    height: Math.round(initialWidth / ASPECT),
    minWidth: MIN_WIDTH,
    minHeight: Math.round(MIN_WIDTH / ASPECT),
    useContentSize: true,
    frame: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    title: 'Kindle Dashboard',
    webPreferences: {
      preload: join(__dirname, '../preload/pip.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })

  window.setAspectRatio(ASPECT)
  window.setAlwaysOnTop(true, 'floating')
  secureWindow(window, BASE_URL)

  window.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!pipWindow || pipWindow.isDestroyed()) return
      applyScale(pipWindow.getContentSize()[0])
    }, 120)
  })
  window.on('closed', () => {
    pipWindow = null
  })

  void window.loadURL(pipUrl(initialWidth))
  pipWindow = window
}

export function destroyPipWindow(): void {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (pipWindow && !pipWindow.isDestroyed()) pipWindow.destroy()
  pipWindow = null
}

export function applyPipPreference(enabled: boolean): void {
  if (enabled) openPipWindow()
  else destroyPipWindow()
}

// Redimensiona a janela aberta quando a escala muda nas configuracoes.
export function applyPipScale(): void {
  if (!pipWindow || pipWindow.isDestroyed()) return
  const width = defaultWidth()
  pipWindow.setContentSize(width, Math.round(width / ASPECT))
  applyScale(width)
}

// Recarrega para puxar os dados mais recentes apos cada render concluido.
export function refreshPipWindow(): void {
  if (!pipWindow || pipWindow.isDestroyed()) return
  const width = pipWindow.getContentSize()[0]
  void pipWindow.loadURL(pipUrl(width)).catch(() => {})
}
