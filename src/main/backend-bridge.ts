import type { Server } from 'node:http'
import { join } from 'node:path'
import { app } from 'electron'
import type { AuthSourceStatus, KindleScriptStatus } from '../shared/types'
import { BASE_URL, PORT } from './constants'
import { runtimeOutputPath } from './paths'

interface BackendDependencies {
  dashImagePath: string
}

interface BackendModule {
  createServer: (dependencies: BackendDependencies) => Server
}

interface AuthModule {
  checkAll: () => AuthSourceStatus[]
}

export interface SshClient {
  end: () => void
}

export interface SshExecResult {
  code: number
  signal?: string | null
  stdout: string
  stderr: string
}

export interface SshOptions {
  host: string
  password: string
  port: number
  username: string
}

export interface KsshModule {
  connect: (options?: SshOptions) => Promise<SshClient>
  execCommand: (client: SshClient, command: string) => Promise<SshExecResult>
}

export interface KindleAutostartModule {
  runAction: (
    action: 'install' | 'status' | 'start' | 'stop' | 'uninstall',
    options: { env: Record<string, string>; ssh: SshOptions },
  ) => Promise<{ code: number; output: string; status: KindleScriptStatus }>
}

let backendServer: Server | null = null

function loadModule<T>(...segments: string[]): T {
  return require(join(app.getAppPath(), ...segments)) as T
}

export function backendModule(): BackendModule {
  return loadModule<BackendModule>('backend', 'server.js')
}

export function authModule(): AuthModule {
  return loadModule<AuthModule>('backend', 'preflight.js')
}

export function ksshModule(): KsshModule {
  return loadModule<KsshModule>('scripts', 'kssh.js')
}

export function kindleAutostartModule(): KindleAutostartModule {
  return loadModule<KindleAutostartModule>('scripts', 'kindle-autostart.js')
}

async function pingBackend(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/ping`, { signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch {
    return false
  }
}

export async function startBackend(): Promise<void> {
  if (await pingBackend()) return

  const server = backendModule().createServer({ dashImagePath: runtimeOutputPath() })
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

export async function stopBackend(): Promise<void> {
  const server = backendServer
  backendServer = null
  if (!server) return

  server.closeIdleConnections?.()
  const closed = new Promise<void>((resolve) => server.close(() => resolve()))
  const timedOut = new Promise<void>((resolve) => setTimeout(resolve, 1500))
  await Promise.race([closed, timedOut])
  server.closeAllConnections?.()
}
