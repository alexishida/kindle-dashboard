import { ActionButton } from '../components/ActionButton'
import { Icon } from '../components/Icon'
import type { Translator } from '../i18n'
import type { NavItem, NavKey } from '../types'

interface SidebarProps {
  appCommit?: string
  appVersion?: string
  backendPill: { className: string; label: string }
  nav: NavKey
  navItems: NavItem[]
  onNav: (key: NavKey) => void
  onOpenRepo: () => void
  t: Translator
}

export function Sidebar({
  appCommit,
  appVersion,
  backendPill,
  nav,
  navItems,
  onNav,
  onOpenRepo,
  t,
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Icon name="book" /></span>
        <strong className="brand-title">{t('panelBrandTitle')}</strong>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          return (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${nav === item.key ? 'active' : ''}`}
              onClick={() => onNav(item.key)}
              title={item.hint}
            >
              <span className="nav-icon" aria-hidden="true"><Icon name={item.icon} /></span>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <div className={`backend-pill ${backendPill.className}`}>
          <span className="status-dot" aria-hidden="true" />
          {backendPill.label}
        </div>
        <div className="about-line">
          <span>v{appVersion ?? '1.0'} ({appCommit ?? 'build'})</span>
          <span className="author-row">
            <span>Alex Ishida</span>
            <ActionButton
              className="icon-link"
              title={t('githubOpen')}
              aria-label={t('githubOpen')}
              onClick={onOpenRepo}
              icon="github"
              iconOnly
            />
          </span>
        </div>
      </div>
    </aside>
  )
}
