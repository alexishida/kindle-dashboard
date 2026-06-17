import type { DashboardApi } from '../shared/types'

declare global {
  interface Window {
    dashboard: DashboardApi
  }
}

export {}
