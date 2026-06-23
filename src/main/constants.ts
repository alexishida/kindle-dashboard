export function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const PORT = positiveInt(process.env.PORT, 8787)
export const BASE_URL = `http://127.0.0.1:${PORT}`
export const REPO_URL = 'https://github.com/alexishida/kindle-dashboard'

export const CAPTURE_WIDTH = 1072
export const CAPTURE_HEIGHT = 1448
export const LANDSCAPE_CAPTURE_WIDTH = CAPTURE_HEIGHT
export const LANDSCAPE_CAPTURE_HEIGHT = CAPTURE_WIDTH
