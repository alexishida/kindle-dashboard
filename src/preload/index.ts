import { contextBridge, ipcRenderer } from 'electron'
import type {
  AuthLoginTool,
  DashboardApi,
  DashboardConfigInput,
  LanguagePreference,
  RenderResult,
} from '../shared/types'

const api: DashboardApi = {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  checkKindle: () => ipcRenderer.invoke('kindle:check'),
  getKindleScriptStatus: () => ipcRenderer.invoke('kindle:script-status'),
  getRuntimeInfo: () => ipcRenderer.invoke('runtime:get'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  installKindle: () => ipcRenderer.invoke('kindle:install'),
  setLanguage: (language: LanguagePreference) => ipcRenderer.invoke('config:set-language', language),
  startKindleScript: () => ipcRenderer.invoke('kindle:script-start'),
  stopKindleScript: () => ipcRenderer.invoke('kindle:script-stop'),
  uninstallKindle: () => ipcRenderer.invoke('kindle:uninstall'),
  openLogin: (tool: AuthLoginTool) => ipcRenderer.invoke('auth:openLogin', tool),
  openRepo: () => ipcRenderer.invoke('app:openRepo'),
  renderNow: () => ipcRenderer.invoke('render:now'),
  saveConfig: (config: DashboardConfigInput) => ipcRenderer.invoke('config:save', config),
  quit: () => ipcRenderer.invoke('app:quit'),
  onOpenPanel: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('panel:open', listener)
    return () => ipcRenderer.removeListener('panel:open', listener)
  },
  onOpenSettings: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('settings:open', listener)
    return () => ipcRenderer.removeListener('settings:open', listener)
  },
  onRenderCompleted: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: RenderResult): void => {
      callback(result)
    }
    ipcRenderer.on('render:completed', listener)
    return () => ipcRenderer.removeListener('render:completed', listener)
  },
}

contextBridge.exposeInMainWorld('dashboard', api)
