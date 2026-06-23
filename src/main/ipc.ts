import { app, ipcMain, shell } from 'electron'
import type {
  AuthLoginTool,
  AuthStatus,
  DashboardConfig,
  DashboardConfigInput,
  KindleInstallResult,
  KindleScriptStatus,
  KindleStatus,
  LanguagePreference,
  RuntimeInfo,
} from '../shared/types'
import { getAuthStatus, openLogin } from './auth'
import { BASE_URL, REPO_URL } from './constants'
import { loadConfig, publicConfig, saveConfig, setLanguage } from './config'
import { currentSystemLanguage } from './i18n'
import { checkKindle, installKindle, manageKindleScript, uninstallKindle } from './kindle'
import { appCommitHash, runtimeOutputPath } from './paths'
import { getIntervalSeconds, getLastRender, renderDashboard, scheduleRender } from './render'
import { refreshTray } from './tray'

interface IpcHandlers {
  quitApplication: () => void
}

export function registerIpc(handlers: IpcHandlers): void {
  ipcMain.handle('runtime:get', async (): Promise<RuntimeInfo> => {
    const config = await loadConfig()
    return {
      appCommit: await appCommitHash(),
      appVersion: app.getVersion(),
      baseUrl: BASE_URL,
      configured: config.setupComplete,
      imageUrl: config.dashboardUrl,
      lastRender: getLastRender(),
      outputPath: runtimeOutputPath(),
      renderIntervalSeconds: getIntervalSeconds(),
      systemLanguage: currentSystemLanguage(),
    }
  })

  ipcMain.handle('config:get', async (): Promise<DashboardConfig> => publicConfig(await loadConfig()))

  ipcMain.handle('config:save', async (_event, config: DashboardConfigInput): Promise<DashboardConfig> => {
    const saved = await saveConfig(config)
    if (saved.kindleRefreshInterval !== getIntervalSeconds()) scheduleRender(saved.kindleRefreshInterval)
    return saved
  })

  ipcMain.handle('config:set-language', async (_event, language: LanguagePreference): Promise<DashboardConfig> => {
    const saved = await setLanguage(language)
    refreshTray()
    return saved
  })

  ipcMain.handle('auth:check', (): AuthStatus => getAuthStatus())
  ipcMain.handle('auth:openLogin', (_event, tool: AuthLoginTool): void => openLogin(tool))
  ipcMain.handle('app:openRepo', () => shell.openExternal(REPO_URL))

  ipcMain.handle('kindle:check', (): Promise<KindleStatus> => checkKindle())
  ipcMain.handle('kindle:install', async (): Promise<KindleInstallResult> => {
    const result = await installKindle()
    refreshTray()
    return result
  })
  ipcMain.handle('kindle:uninstall', async (): Promise<KindleInstallResult> => {
    const result = await uninstallKindle()
    refreshTray()
    return result
  })
  ipcMain.handle('kindle:script-status', (): Promise<KindleScriptStatus> => manageKindleScript('status'))
  ipcMain.handle('kindle:script-start', (): Promise<KindleScriptStatus> => manageKindleScript('start'))
  ipcMain.handle('kindle:script-stop', (): Promise<KindleScriptStatus> => manageKindleScript('stop'))

  ipcMain.handle('render:now', () => renderDashboard())
  ipcMain.handle('app:quit', () => {
    handlers.quitApplication()
  })
}
