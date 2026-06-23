import PreviewFrame from '../PreviewFrame'
import type { Translator } from '../i18n'
import type { SupportedLanguage } from '../../../shared/types'

interface PanelViewProps {
  baseUrl: string | undefined
  language: SupportedLanguage
  previewKey: number
  t: Translator
}

export function PanelView({ baseUrl, language, previewKey, t }: PanelViewProps): React.JSX.Element {
  return (
    <section className="dashboard-grid">
      <section className="preview-wrap">
        <section className="preview-panel">
          {baseUrl ? (
            <PreviewFrame baseUrl={baseUrl} language={language} previewKey={previewKey} />
          ) : (
            <div className="loading">{t('appLoading')}</div>
          )}
        </section>
      </section>
    </section>
  )
}
