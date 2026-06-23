import { LANGUAGES, languageName, type Translator } from '../i18n'
import type { LanguagePreference, SupportedLanguage } from '../../../shared/types'

interface SettingsViewProps {
  disabled: boolean
  languagePreference: LanguagePreference
  onChangeLanguage: (language: LanguagePreference) => void
  saving: boolean
  systemLanguage: SupportedLanguage | undefined
  t: Translator
}

export function SettingsView({
  disabled,
  languagePreference,
  onChangeLanguage,
  saving,
  systemLanguage,
  t,
}: SettingsViewProps): React.JSX.Element {
  return (
    <section className="single-grid settings-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('languageSectionEyebrow')}</p>
            <h2>{t('languageSectionTitle')}</h2>
          </div>
        </div>

        <label className="wide-field">
          <span>{t('languageField')}</span>
          <select
            value={languagePreference}
            onChange={(event) => onChangeLanguage(event.target.value as LanguagePreference)}
            disabled={saving || disabled}
          >
            <option value="system">{t('languageAuto')}</option>
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>{language.name}</option>
            ))}
          </select>
        </label>

        <p className="field-note standalone-note">
          {t('languageDetected', { value: languageName(systemLanguage ?? 'en') })}
        </p>
      </section>
    </section>
  )
}
