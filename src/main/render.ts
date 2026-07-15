import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { BrowserWindow, nativeImage, screen } from 'electron'
import type { RenderResult } from '../shared/types'
import {
  BASE_URL,
  CAPTURE_HEIGHT,
  CAPTURE_WIDTH,
  LANDSCAPE_CAPTURE_HEIGHT,
  LANDSCAPE_CAPTURE_WIDTH,
} from './constants'
import { getActiveLanguage, text } from './i18n'
import { runtimeOutputPath } from './paths'
import { refreshPipWindow } from './pip'
import { getMainWindow, secureWindow } from './windows'

interface CaptureViewport {
  height: number
  scale: number
  width: number
}

let captureWindow: BrowserWindow | null = null
let renderTimer: NodeJS.Timeout | null = null
let renderIntervalSeconds = 0
let renderInFlight: Promise<RenderResult> | null = null
let lastRenderResult: RenderResult | null = null
const RENDER_READY_TIMEOUT_MS = 20000

export function getIntervalSeconds(): number {
  return renderIntervalSeconds
}

export function getLastRender(): RenderResult | null {
  return lastRenderResult
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

async function waitUntilReady(window: BrowserWindow, readyTitle: string): Promise<void> {
  const deadline = Date.now() + RENDER_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (window.webContents.getTitle() === readyTitle) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(text('renderTimeout'))
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
  const outputPath = runtimeOutputPath()
  const viewport = captureViewport()
  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = createCaptureWindow(viewport)
  } else {
    captureWindow.setContentSize(viewport.width, viewport.height)
  }

  const captureId = Date.now().toString()
  const captureScale = viewport.scale.toFixed(6)
  const readyTitle = `READY:${captureId}`
  await captureWindow.loadURL(
    `${BASE_URL}/render?capture=${captureId}&ready=${encodeURIComponent(captureId)}&captureScale=${captureScale}&lang=${encodeURIComponent(getActiveLanguage())}`,
  )
  await waitUntilReady(captureWindow, readyTitle)
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
  getMainWindow()?.webContents.send('render:completed', result)
  refreshPipWindow()
  return result
}

export function renderDashboard(): Promise<RenderResult> {
  if (!renderInFlight) {
    renderInFlight = performRender().finally(() => {
      renderInFlight = null
    })
  }
  return renderInFlight
}

export function scheduleRender(intervalSeconds: number): void {
  if (renderTimer) clearInterval(renderTimer)
  renderIntervalSeconds = intervalSeconds
  renderTimer = setInterval(() => {
    void renderDashboard().catch((error) => {
      console.error('render failed', error)
    })
  }, intervalSeconds * 1000)
}

export function stopRenderTimer(): void {
  if (renderTimer) {
    clearInterval(renderTimer)
    renderTimer = null
  }
}

export function destroyCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy()
  captureWindow = null
}
