import { ActionButton } from '../components/ActionButton'
import type { Translator } from '../i18n'
import { formatExpiry, sourceAction } from '../lib/format'
import type { AuthLoginTool, AuthSourceStatus, SupportedLanguage } from '../../../shared/types'

interface LoginsViewProps {
  checking: boolean
  language: SupportedLanguage
  onLogin: (tool: AuthLoginTool) => void
  onRecheck: () => void
  sources: AuthSourceStatus[] | undefined
  t: Translator
}

export function LoginsView({ checking, language, onLogin, onRecheck, sources, t }: LoginsViewProps): React.JSX.Element {
  return (
    <section className="single-grid">
      <section className="panel diagnostics-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('authEyebrow')}</p>
            <h2>{t('authTitle')}</h2>
          </div>
          <ActionButton className="ghost" icon="refresh" onClick={onRecheck} disabled={checking}>
            {checking ? t('authChecking') : t('authRecheck')}
          </ActionButton>
        </div>

        <div className="status-list">
          {sources?.map((source) => {
            const action = sourceAction(source)
            const vars = source.detailVars?.expiresAt
              ? { ...source.detailVars, expiresAt: formatExpiry(source.detailVars.expiresAt, language) }
              : source.detailVars
            return (
              <div className="status-row" key={source.name}>
                <span className={`badge ${source.ok ? 'ok' : 'warn'}`}>{source.ok ? t('ok') : t('action')}</span>
                <div>
                  <strong>{source.label}</strong>
                  <p>{t(source.detailKey, vars)}</p>
                  {!source.ok && source.hintKey ? <small>{t(source.hintKey)}</small> : null}
                </div>
                {action ? (
                  <ActionButton className="ghost" icon="login" onClick={() => onLogin(action)}>
                    {t('loginButton')}
                  </ActionButton>
                ) : null}
              </div>
            )
          })}
          {!sources ? <p className="muted">{t('authLoading')}</p> : null}
        </div>
      </section>
    </section>
  )
}
