import { LANGUAGES, languageName, type Translator } from '../i18n'
import type { LanguagePreference, SupportedLanguage } from '../../../shared/types'

const PIP_SCALE_OPTIONS = [1, 1.25, 1.5, 1.75, 2]

interface SettingsViewProps {
  disabled: boolean
  languagePreference: LanguagePreference
  onChangeLanguage: (language: LanguagePreference) => void
  onChangePictureInPictureScale: (scale: number) => void
  onTogglePictureInPicture: (enabled: boolean) => void
  pictureInPicture: boolean
  pictureInPictureScale: number
  saving: boolean
  savingPip: boolean
  savingPipScale: boolean
  systemLanguage: SupportedLanguage | undefined
  t: Translator
}

export function SettingsView({
  disabled,
  languagePreference,
  onChangeLanguage,
  onChangePictureInPictureScale,
  onTogglePictureInPicture,
  pictureInPicture,
  pictureInPictureScale,
  saving,
  savingPip,
  savingPipScale,
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('pipSectionEyebrow')}</p>
            <h2>{t('pipSectionTitle')}</h2>
          </div>
        </div>

        <label className="toggle-field">
          <span className="toggle-text">
            <span className="toggle-label">{t('pipField')}</span>
            <span className="toggle-status">{pictureInPicture ? t('pipOn') : t('pipOff')}</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={pictureInPicture}
              onChange={(event) => onTogglePictureInPicture(event.target.checked)}
              disabled={savingPip || disabled}
            />
            <span className="switch-track" aria-hidden="true" />
          </span>
        </label>

        <label className="wide-field">
          <span>{t('pipScaleField')}</span>
          <select
            value={String(pictureInPictureScale)}
            onChange={(event) => onChangePictureInPictureScale(Number.parseFloat(event.target.value))}
            disabled={savingPipScale || disabled}
          >
            {PIP_SCALE_OPTIONS.map((scale) => (
              <option key={scale} value={scale}>{`${scale}x`}</option>
            ))}
          </select>
        </label>

        <p className="field-note standalone-note">{t('pipNote')}</p>
      </section>
    </section>
  )
}
