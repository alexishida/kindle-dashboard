import { Menu, Tray } from 'electron'
import { text } from './i18n'
import { appAssetPath } from './paths'

export interface TrayHandlers {
  onOpenPanel: () => void
  onOpenSettings: () => void
  onQuit: () => void
  onRefresh: () => void
}

let tray: Tray | null = null
let trayHandlers: TrayHandlers | null = null

function buildTrayMenu(handlers: TrayHandlers): Menu {
  return Menu.buildFromTemplate([
    { label: text('trayOpenPanel'), click: handlers.onOpenPanel },
    { label: text('trayOpenSettings'), click: handlers.onOpenSettings },
    { label: text('trayRefresh'), click: handlers.onRefresh },
    { type: 'separator' },
    { label: text('trayQuit'), click: handlers.onQuit },
  ])
}

export function createTray(handlers: TrayHandlers): void {
  trayHandlers = handlers
  if (tray) {
    tray.setContextMenu(buildTrayMenu(handlers))
    return
  }

  tray = new Tray(appAssetPath('icon.png'))
  tray.setToolTip('Kindle Dashboard')
  tray.setContextMenu(buildTrayMenu(handlers))
  tray.on('click', handlers.onOpenPanel)
}

// Reconstrói o menu (ex.: após troca de idioma) usando os handlers já registrados.
export function refreshTray(): void {
  if (tray && trayHandlers) tray.setContextMenu(buildTrayMenu(trayHandlers))
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
