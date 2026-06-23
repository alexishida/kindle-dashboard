import { contextBridge, ipcRenderer } from 'electron'

// Ponte minima exclusiva da janela PiP: expoe apenas o fechar, nada mais.
// A pagina PiP vem do backend (http), entao nao recebe a API completa do app.
contextBridge.exposeInMainWorld('pipControls', {
  close: (): Promise<void> => ipcRenderer.invoke('pip:close'),
})
