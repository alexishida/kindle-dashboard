import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import type { Server } from 'node:http'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, safeStorage, screen, shell, Tray } from 'electron'
import type {
  AuthLoginTool,
  AuthSourceStatus,
  AuthStatus,
  DashboardConfig,
  DashboardConfigInput,
  KindleInstallResult,
  KindleScriptStatus,
  KindleStatus,
  RenderResult,
  RuntimeInfo,
} from '../shared/types'

interface BackendDependencies {
  dashImagePath: string
}

interface BackendModule {
  createServer: (dependencies: BackendDependencies) => Server
}

interface AuthModule {
  checkAll: () => AuthSourceStatus[]
}

interface SshClient {
  end: () => void
}

interface SshExecResult {
  code: number
  signal?: string | null
  stdout: string
  stderr: string
}

interface KsshModule {
  connect: (options?: SshOptions) => Promise<SshClient>
  execCommand: (client: SshClient, command: string) => Promise<SshExecResult>
}

interface KindleAutostartModule {
  runAction: (
    action: 'install' | 'status' | 'start' | 'stop' | 'uninstall',
    options: { env: Record<string, string>, ssh: SshOptions },
  ) => Promise<{ code: number, output: string, status: KindleScriptStatus }>
}

interface SshOptions {
  host: string
  password: string
  port: number
  username: string
}

interface StoredDashboardConfig {
  dashboardUrl: string
  kindleFullRefreshEvery: number
  kindleIp: string
  kindlePasswordEncoding?: 'plain' | 'safeStorage'
  kindlePasswordEncrypted?: string
  kindlePasswordPlain?: string
  kindlePort: number
  kindleRefreshInterval: number
  kindleUser: string
  kindleWifiRetryEvery: number
  setupComplete: boolean
}

const PORT = positiveInt(process.env.PORT, 8787)
const BASE_URL = `http://127.0.0.1:${PORT}`
const REPO_URL = 'https://github.com/alexishida/kindle-dashboard'
const CAPTURE_WIDTH = 1072
const CAPTURE_HEIGHT = 1448
const LANDSCAPE_CAPTURE_WIDTH = CAPTURE_HEIGHT
const LANDSCAPE_CAPTURE_HEIGHT = CAPTURE_WIDTH

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendServer: Server | null = null
let renderTimer: NodeJS.Timeout | null = null
let renderIntervalSeconds = 0
let renderInFlight: Promise<RenderResult> | null = null
let lastRenderResult: RenderResult | null = null
let dashboardConfig: StoredDashboardConfig | null = null
let quitInProgress: Promise<void> | null = null
let quitting = false
let outputPath = ''
let cachedAppCommit = process.env.APP_COMMIT?.trim() || process.env.GIT_COMMIT?.trim() || process.env.SOURCE_VERSION?.trim() || ''

const execFileAsync = promisify(execFile)

interface CaptureViewport {
  height: number
  scale: number
  width: number
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function appCommitHash(): Promise<string> {
  if (cachedAppCommit) return cachedAppCommit.slice(0, 7)

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: app.getAppPath(),
      windowsHide: true,
    })
    cachedAppCommit = stdout.trim()
  } catch {
    cachedAppCommit = 'build'
  }

  return cachedAppCommit
}

function boolField(fields: Record<string, string>, key: string): boolean {
  return fields[key] === 'yes'
}

function appAssetPath(name: string): string {
  if (app.isPackaged) return join(process.resourcesPath, name)
  return join(app.getAppPath(), 'build', name)
}

function runtimeOutputPath(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'runtime', 'dash.png')
  return join(app.getAppPath(), 'out', 'dash.png')
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function backendModule(): BackendModule {
  const modulePath = join(app.getAppPath(), 'backend', 'server.js')
  return require(modulePath) as BackendModule
}

function authModule(): AuthModule {
  const modulePath = join(app.getAppPath(), 'backend', 'preflight.js')
  return require(modulePath) as AuthModule
}

function ksshModule(): KsshModule {
  const modulePath = join(app.getAppPath(), 'scripts', 'kssh.js')
  return require(modulePath) as KsshModule
}

function kindleAutostartModule(): KindleAutostartModule {
  const modulePath = join(app.getAppPath(), 'scripts', 'kindle-autostart.js')
  return require(modulePath) as KindleAutostartModule
}

function defaultDashboardUrl(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return `http://${entry.address}:${PORT}/dash.png`
      }
    }
  }

  return `http://127.0.0.1:${PORT}/dash.png`
}

function defaultStoredConfig(): StoredDashboardConfig {
  return {
    dashboardUrl: defaultDashboardUrl(),
    kindleFullRefreshEvery: 20,
    kindleIp: '',
    kindlePort: 22,
    kindleRefreshInterval: 45,
    kindleUser: '',
    kindleWifiRetryEvery: 3,
    setupComplete: false,
  }
}

function decryptPassword(config: StoredDashboardConfig): string {
  if (config.kindlePasswordEncoding === 'safeStorage' && config.kindlePasswordEncrypted) {
    return safeStorage.decryptString(Buffer.from(config.kindlePasswordEncrypted, 'base64'))
  }
  return config.kindlePasswordPlain ?? ''
}

function encryptedPasswordFields(password: string): Partial<StoredDashboardConfig> {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      kindlePasswordEncrypted: safeStorage.encryptString(password).toString('base64'),
      kindlePasswordEncoding: 'safeStorage',
      kindlePasswordPlain: undefined,
    }
  }

  return {
    kindlePasswordEncoding: 'plain',
    kindlePasswordEncrypted: undefined,
    kindlePasswordPlain: password,
  }
}

function hasSavedPassword(config: StoredDashboardConfig): boolean {
  return Boolean(config.kindlePasswordEncrypted || config.kindlePasswordPlain)
}

function publicConfig(config: StoredDashboardConfig): DashboardConfig {
  return {
    dashboardUrl: config.dashboardUrl,
    kindleFullRefreshEvery: config.kindleFullRefreshEvery,
    kindleIp: config.kindleIp,
    kindlePasswordSaved: hasSavedPassword(config),
    kindlePort: config.kindlePort,
    kindleRefreshInterval: config.kindleRefreshInterval,
    kindleUser: config.kindleUser,
    kindleWifiRetryEvery: config.kindleWifiRetryEvery,
    setupComplete: config.setupComplete,
  }
}

async function loadConfig(): Promise<StoredDashboardConfig> {
  if (dashboardConfig) return dashboardConfig

  const defaults = defaultStoredConfig()
  try {
    const raw = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Partial<StoredDashboardConfig>
    dashboardConfig = {
      ...defaults,
      dashboardUrl: typeof raw.dashboardUrl === 'string' ? raw.dashboardUrl : defaults.dashboardUrl,
      kindleFullRefreshEvery: positiveInt(String(raw.kindleFullRefreshEvery ?? ''), defaults.kindleFullRefreshEvery),
      kindleIp: typeof raw.kindleIp === 'string' ? raw.kindleIp : defaults.kindleIp,
      kindlePasswordEncoding: raw.kindlePasswordEncoding,
      kindlePasswordEncrypted: typeof raw.kindlePasswordEncrypted === 'string' ? raw.kindlePasswordEncrypted : undefined,
      kindlePasswordPlain: typeof raw.kindlePasswordPlain === 'string' ? raw.kindlePasswordPlain : undefined,
      kindlePort: positiveInt(String(raw.kindlePort ?? ''), defaults.kindlePort),
      kindleRefreshInterval: positiveInt(String(raw.kindleRefreshInterval ?? ''), defaults.kindleRefreshInterval),
      kindleUser: typeof raw.kindleUser === 'string' ? raw.kindleUser : defaults.kindleUser,
      kindleWifiRetryEvery: positiveInt(String(raw.kindleWifiRetryEvery ?? ''), defaults.kindleWifiRetryEvery),
      setupComplete: raw.setupComplete === true,
    }
  } catch {
    dashboardConfig = defaults
  }

  return dashboardConfig
}

async function writeConfig(config: StoredDashboardConfig): Promise<void> {
  dashboardConfig = config
  await fs.mkdir(dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function recordInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Configuracao invalida')
  }
  return value as Record<string, unknown>
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key]
  if (typeof value !== 'string') throw new Error(`${key} deve ser texto`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${key} e obrigatorio`)
  if (trimmed.length > maxLength) throw new Error(`${key} e muito longo`)
  return trimmed
}

function numberField(input: Record<string, unknown>, key: string, fallback: number, max = 65535): number {
  const value = typeof input[key] === 'number' ? input[key] : Number.parseInt(String(input[key] ?? ''), 10)
  if (!Number.isInteger(value) || value <= 0 || value > max) return fallback
  return value
}

function normalizedDashboardUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('A URL do dashboard deve usar http ou https')
  }
  return url.toString()
}

async function saveConfig(raw: unknown): Promise<DashboardConfig> {
  const input = recordInput(raw)
  const previous = await loadConfig()
  const password = typeof input.kindlePassword === 'string' ? input.kindlePassword : ''
  const next: StoredDashboardConfig = {
    ...previous,
    dashboardUrl: normalizedDashboardUrl(requiredString(input, 'dashboardUrl', 500)),
    kindleFullRefreshEvery: numberField(input, 'kindleFullRefreshEvery', previous.kindleFullRefreshEvery, 1000),
    kindleIp: requiredString(input, 'kindleIp', 255),
    kindlePort: numberField(input, 'kindlePort', previous.kindlePort),
    kindleRefreshInterval: numberField(input, 'kindleRefreshInterval', previous.kindleRefreshInterval, 86400),
    kindleUser: requiredString(input, 'kindleUser', 64),
    kindleWifiRetryEvery: numberField(input, 'kindleWifiRetryEvery', previous.kindleWifiRetryEvery, 1000),
  }

  if (password) Object.assign(next, encryptedPasswordFields(password))

  await writeConfig(next)
  if (next.kindleRefreshInterval !== renderIntervalSeconds) scheduleRender(next.kindleRefreshInterval)
  return publicConfig(next)
}

function sshOptions(config: StoredDashboardConfig): SshOptions {
  const password = decryptPassword(config)
  if (!password) throw new Error('Informe e salve a senha SSH do Kindle antes de conectar')

  return {
    host: config.kindleIp,
    password,
    port: config.kindlePort,
    username: config.kindleUser,
  }
}

function kindleEnvironment(config: StoredDashboardConfig): Record<string, string> {
  return {
    DASHBOARD_URL: config.dashboardUrl,
    KINDLE_FULL_REFRESH_EVERY: String(config.kindleFullRefreshEvery),
    KINDLE_REFRESH_INTERVAL: String(config.kindleRefreshInterval),
    KINDLE_WIFI_RETRY_EVERY: String(config.kindleWifiRetryEvery),
  }
}

function parseKeyValueOutput(output: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index > 0) fields[line.slice(0, index)] = line.slice(index + 1)
  }
  return fields
}

function getAuthStatus(): AuthStatus {
  const sources = authModule().checkAll()
  return {
    checkedAt: new Date().toISOString(),
    ok: sources.every((source) => source.ok),
    sources,
  }
}

async function checkKindle(): Promise<KindleStatus> {
  const checkedAt = new Date().toISOString()
  const config = await loadConfig()
  let client: SshClient | null = null

  try {
    client = await ksshModule().connect(sshOptions(config))
    const result = await ksshModule().execCommand(client, `
PATH=/sbin:/usr/sbin:/bin:/usr/bin
export PATH
yn() { if "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }
MODEL="$(cat /etc/prettyversion.txt 2>/dev/null || uname -a)"
echo "model=$MODEL"
echo "path=$PATH"
echo "fbink=$(yn command -v fbink)"
echo "initctl=$(yn command -v initctl)"
echo "mntroot=$(yn command -v mntroot)"
echo "mntus=$(yn test -d /mnt/us)"
echo "hotfix=$(yn test -f /etc/upstart/kmc.conf)"
`)

    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`)
    }

    const fields = parseKeyValueOutput(result.stdout)
    const fbink = boolField(fields, 'fbink')
    const initctl = boolField(fields, 'initctl')
    const mntroot = boolField(fields, 'mntroot')
    const mntus = boolField(fields, 'mntus')
    const hotfix = boolField(fields, 'hotfix')
    const jailbroken = fbink && initctl && mntroot && mntus
    const canInstall = jailbroken && hotfix
    const missing = [
      !fbink && 'fbink',
      !initctl && 'initctl',
      !mntroot && 'mntroot',
      !mntus && '/mnt/us',
      !hotfix && 'hotfix/Upstart',
    ].filter(Boolean).join(', ')
    const missingDetail = missing
      ? `SSH conectado, mas falta: ${missing}. PATH remoto: ${fields.path || 'desconhecido'}`
      : 'Kindle pronto para receber os scripts'

    return {
      canInstall,
      checkedAt,
      connected: true,
      detail: canInstall ? 'Kindle pronto para receber os scripts' : missingDetail,
      fbink,
      hotfix,
      initctl,
      jailbroken,
      mntroot,
      mntus,
      model: fields.model || null,
    }
  } catch (error) {
    return {
      canInstall: false,
      checkedAt,
      connected: false,
      detail: `Falha no SSH: ${error instanceof Error ? error.message : String(error)}`,
      fbink: false,
      hotfix: false,
      initctl: false,
      jailbroken: false,
      mntroot: false,
      mntus: false,
      model: null,
    }
  } finally {
    client?.end()
  }
}

async function installKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()
  const status = await checkKindle()
  if (!status.canInstall) throw new Error(status.detail)

  const result = await kindleAutostartModule().runAction('install', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || `Install failed with exit ${result.code}`)

  const next = { ...config, setupComplete: true }
  await writeConfig(next)
  createTray()

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

async function uninstallKindle(): Promise<KindleInstallResult> {
  const config = await loadConfig()

  const result = await kindleAutostartModule().runAction('uninstall', {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || `Uninstall failed with exit ${result.code}`)

  const next = { ...config, setupComplete: false }
  await writeConfig(next)
  createTray()

  return {
    config: publicConfig(next),
    output: result.output,
    status: result.status,
  }
}

async function manageKindleScript(action: 'status' | 'start' | 'stop'): Promise<KindleScriptStatus> {
  const config = await loadConfig()
  const result = await kindleAutostartModule().runAction(action, {
    env: kindleEnvironment(config),
    ssh: sshOptions(config),
  })
  if (result.code !== 0) throw new Error(result.output || `Kindle script action failed with exit ${result.code}`)
  return result.status
}

function loginScript(tool: AuthLoginTool): string {
  const label = tool === 'claude' ? 'Claude Code' : 'OpenAI Codex'
  const command = tool === 'claude' ? 'claude' : 'codex login'

  return [
    `$Host.UI.RawUI.WindowTitle = 'Kindle Dashboard - ${label}'`,
    `Write-Host 'Kindle Dashboard - login ${label}'`,
    "Write-Host ''",
    `Write-Host 'Executando: ${command}'`,
    "Write-Host 'Se o comando nao for encontrado, rode-o em um terminal normal e depois clique em Reverificar no app.'",
    "Write-Host ''",
    command,
    "Write-Host ''",
    "Write-Host 'Quando terminar, volte ao Kindle Dashboard e clique em Reverificar.'",
  ].join('; ')
}

function openLogin(tool: unknown): void {
  if (tool !== 'claude' && tool !== 'codex') throw new Error('Ferramenta invalida')

  if (process.platform === 'win32') {
    const title = tool === 'claude' ? 'Kindle Dashboard - Claude Login' : 'Kindle Dashboard - Codex Login'
    const child = spawn('cmd.exe', [
      '/d',
      '/s',
      '/c',
      'start',
      title,
      'powershell.exe',
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      loginScript(tool),
    ], {
      cwd: app.getPath('home'),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return
  }

  const child = spawn(tool === 'claude' ? 'claude' : 'codex login', {
    cwd: app.getPath('home'),
    detached: true,
    shell: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function pingBackend(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/ping`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function startBackend(): Promise<void> {
  if (await pingBackend()) return

  const server = backendModule().createServer({ dashImagePath: outputPath })
  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = (): void => {
      server.removeListener('error', onError)
      backendServer = server
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(PORT, '0.0.0.0')
  })
}

function secureWindow(window: BrowserWindow, allowedOrigin: string): void {
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

function createMainWindow(options: { showOnReady: boolean } = { showOnReady: true }): BrowserWindow {
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
  return window
}

function restoreMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow({ showOnReady: true })
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function showSettingsWindow(): void {
  restoreMainWindow()
  sendToRenderer('settings:open')
}

function createTray(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
    return
  }

  tray = new Tray(appAssetPath('icon.png'))
  tray.setToolTip('Kindle Dashboard')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', restoreMainWindow)
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Abrir configuracoes',
      click: showSettingsWindow,
    },
    { type: 'separator' },
    {
      label: 'Encerrar',
      click: quitApplication,
    },
  ])
}

function captureViewport(): CaptureViewport {
  const { height, width } = screen.getPrimaryDisplay().workAreaSize
  const scale = Math.min(1, width / LANDSCAPE_CAPTURE_WIDTH, height / LANDSCAPE_CAPTURE_HEIGHT)
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  return {
    height: Math.max(1, Math.floor(LANDSCAPE_CAPTURE_HEIGHT * safeScale)),
    scale: safeScale,
    width: Math.max(1, Math.floor(LANDSCAPE_CAPTURE_WIDTH * safeScale)),
  }
}

function rotateClockwise(image: Electron.NativeImage): Electron.NativeImage {
  const normalized = image.resize({
    height: LANDSCAPE_CAPTURE_HEIGHT,
    quality: 'best',
    width: LANDSCAPE_CAPTURE_WIDTH,
  })
  const bitmap = normalized.toBitmap()
  const rotated = Buffer.alloc(bitmap.length)
  const bytesPerPixel = 4

  for (let y = 0; y < LANDSCAPE_CAPTURE_HEIGHT; y += 1) {
    for (let x = 0; x < LANDSCAPE_CAPTURE_WIDTH; x += 1) {
      const source = (y * LANDSCAPE_CAPTURE_WIDTH + x) * bytesPerPixel
      const targetX = LANDSCAPE_CAPTURE_HEIGHT - 1 - y
      const targetY = x
      const target = (targetY * CAPTURE_WIDTH + targetX) * bytesPerPixel
      bitmap.copy(rotated, target, source, source + bytesPerPixel)
    }
  }

  return nativeImage.createFromBitmap(rotated, {
    height: CAPTURE_HEIGHT,
    scaleFactor: 1,
    width: CAPTURE_WIDTH,
  })
}

function createCaptureWindow(viewport: CaptureViewport): BrowserWindow {
  const window = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    useContentSize: true,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })
  secureWindow(window, BASE_URL)
  window.on('closed', () => {
    captureWindow = null
  })
  return window
}

async function waitUntilReady(window: BrowserWindow): Promise<void> {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (window.webContents.getTitle() === 'READY') return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Dashboard render timed out')
}

async function replaceFile(temporaryPath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(temporaryPath, destinationPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (!['EEXIST', 'EPERM'].includes(code ?? '')) throw error
    await fs.copyFile(temporaryPath, destinationPath)
    await fs.unlink(temporaryPath)
  }
}

async function performRender(): Promise<RenderResult> {
  const viewport = captureViewport()
  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = createCaptureWindow(viewport)
  } else {
    captureWindow.setContentSize(viewport.width, viewport.height)
  }

  const captureScale = viewport.scale.toFixed(6)
  await captureWindow.loadURL(`${BASE_URL}/render?capture=${Date.now()}&captureScale=${captureScale}`)
  await waitUntilReady(captureWindow)
  const image = await captureWindow.webContents.capturePage({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  })
  const rotated = rotateClockwise(image)

  const temporaryPath = `${outputPath}.${process.pid}.tmp`
  await fs.mkdir(dirname(outputPath), { recursive: true })
  await fs.writeFile(temporaryPath, rotated.toPNG())
  await replaceFile(temporaryPath, outputPath)

  const result = {
    outputPath,
    updatedAt: new Date().toISOString(),
  }
  lastRenderResult = result
  mainWindow?.webContents.send('render:completed', result)
  return result
}

function renderDashboard(): Promise<RenderResult> {
  if (!renderInFlight) {
    renderInFlight = performRender().finally(() => {
      renderInFlight = null
    })
  }
  return renderInFlight
}

function scheduleRender(intervalSeconds: number): void {
  if (renderTimer) clearInterval(renderTimer)
  renderIntervalSeconds = intervalSeconds
  renderTimer = setInterval(() => {
    void renderDashboard().catch((error) => {
      console.error('render failed', error)
    })
  }, intervalSeconds * 1000)
}

function registerIpc(): void {
  ipcMain.handle('runtime:get', async (): Promise<RuntimeInfo> => {
    const config = await loadConfig()
    return {
      appCommit: await appCommitHash(),
      appVersion: app.getVersion(),
      baseUrl: BASE_URL,
      configured: config.setupComplete,
      imageUrl: config.dashboardUrl,
      lastRender: lastRenderResult,
      outputPath,
      renderIntervalSeconds,
    }
  })
  ipcMain.handle('config:get', async (): Promise<DashboardConfig> => publicConfig(await loadConfig()))
  ipcMain.handle('config:save', (_event, config: DashboardConfigInput) => saveConfig(config))
  ipcMain.handle('auth:check', (): AuthStatus => getAuthStatus())
  ipcMain.handle('auth:openLogin', (_event, tool: AuthLoginTool): void => openLogin(tool))
  ipcMain.handle('app:openRepo', () => shell.openExternal(REPO_URL))
  ipcMain.handle('kindle:check', (): Promise<KindleStatus> => checkKindle())
  ipcMain.handle('kindle:install', (): Promise<KindleInstallResult> => installKindle())
  ipcMain.handle('kindle:script-status', (): Promise<KindleScriptStatus> => manageKindleScript('status'))
  ipcMain.handle('kindle:script-start', (): Promise<KindleScriptStatus> => manageKindleScript('start'))
  ipcMain.handle('kindle:script-stop', (): Promise<KindleScriptStatus> => manageKindleScript('stop'))
  ipcMain.handle('kindle:uninstall', (): Promise<KindleInstallResult> => uninstallKindle())
  ipcMain.handle('render:now', () => renderDashboard())
  ipcMain.handle('app:quit', () => {
    quitApplication()
  })
}

async function runStartupChecks(): Promise<void> {
  const auth = getAuthStatus()
  if (auth.ok) return

  if (Notification.isSupported()) {
    new Notification({
      title: 'Kindle Dashboard',
      body: 'Claude ou Codex precisa de login. Abra as configuracoes para corrigir.',
    }).show()
  }
  showSettingsWindow()
}

async function shutdown(): Promise<void> {
  if (renderTimer) {
    clearInterval(renderTimer)
    renderTimer = null
  }

  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy()
  captureWindow = null
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  mainWindow = null
  tray?.destroy()
  tray = null

  const server = backendServer
  backendServer = null
  if (server) {
    server.closeIdleConnections?.()
    const closed = new Promise<void>((resolve) => server.close(() => resolve()))
    const timedOut = new Promise<void>((resolve) => setTimeout(resolve, 1500))
    await Promise.race([closed, timedOut])
    server.closeAllConnections?.()
  }
}

function quitApplication(): void {
  if (quitInProgress) return

  quitting = true
  quitInProgress = shutdown()
    .catch((error) => {
      console.error('shutdown failed', error)
    })
    .finally(() => {
      app.exit(0)
    })
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
    outputPath = runtimeOutputPath()
    dashboardConfig = await loadConfig()
    scheduleRender(dashboardConfig.kindleRefreshInterval)
    registerIpc()
    await startBackend()
    mainWindow = createMainWindow({ showOnReady: !dashboardConfig.setupComplete })
    createTray()
    await renderDashboard()
    if (dashboardConfig.setupComplete) void runStartupChecks()
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    restoreMainWindow()
  })

  app.on('before-quit', () => {
    quitting = true
  })

  app.on('will-quit', (event) => {
    if (quitInProgress) return
    event.preventDefault()
    quitApplication()
  })
}
