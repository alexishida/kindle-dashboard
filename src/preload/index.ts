import { contextBridge, ipcRenderer } from 'electron'
import type { AuthLoginTool, DashboardApi, DashboardConfigInput, RenderResult } from '../shared/types'

const api: DashboardApi = {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  checkKindle: () => ipcRenderer.invoke('kindle:check'),
  getRuntimeInfo: () => ipcRenderer.invoke('runtime:get'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  installKindle: () => ipcRenderer.invoke('kindle:install'),
  uninstallKindle: () => ipcRenderer.invoke('kindle:uninstall'),
  openLogin: (tool: AuthLoginTool) => ipcRenderer.invoke('auth:openLogin', tool),
  openRepo: () => ipcRenderer.invoke('app:openRepo'),
  renderNow: () => ipcRenderer.invoke('render:now'),
  saveConfig: (config: DashboardConfigInput) => ipcRenderer.invoke('config:save', config),
  quit: () => ipcRenderer.invoke('app:quit'),
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
