import { ActionButton } from '../components/ActionButton'
import type { Translator } from '../i18n'
import { formatTime } from '../lib/format'
import type { NavItem, NavKey } from '../types'
import type { SupportedLanguage } from '../../../shared/types'

interface TopbarProps {
  activeNav: NavItem
  canRender: boolean
  language: SupportedLanguage
  lastRender: string | null
  nav: NavKey
  onRender: () => void
  rendering: boolean
  t: Translator
}

export function Topbar({
  activeNav,
  canRender,
  language,
  lastRender,
  nav,
  onRender,
  rendering,
  t,
}: TopbarProps): React.JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <p className="eyebrow">{activeNav.hint}</p>
        <h1>{activeNav.label}</h1>
      </div>

      {nav === 'painel' ? (
        <>
          <div className="topbar-meta">
            <span className="meta-item">
              <span className="meta-key">{t('lastImage')}</span>
              <span className="meta-val">{formatTime(lastRender, language, t('loading'))}</span>
            </span>
          </div>

          <div className="actions">
            <ActionButton icon="refresh" onClick={onRender} disabled={rendering || !canRender}>
              {rendering ? t('refreshNowBusy') : t('refreshNow')}
            </ActionButton>
          </div>
        </>
      ) : null}
    </header>
  )
}
