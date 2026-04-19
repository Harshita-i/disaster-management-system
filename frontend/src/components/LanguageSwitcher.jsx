import { useTranslation } from 'react-i18next';

const OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'zh', label: '中文 (Chinese)' },
];

export default function LanguageSwitcher({ compact = false, variant = 'dark' }) {
  const { i18n, t } = useTranslation();
  const raw = i18n.language || 'en';
  const base = String(raw).replace(/_/g, '-').split('-')[0];
  const value = OPTIONS.some((o) => o.code === base) ? base : 'en';

  const cls = [
    'lang-switch',
    variant === 'light' ? 'lang-switch--light' : 'lang-switch--dark',
    compact ? 'lang-switch--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={cls}>
      <span>{t('common.language')}</span>
      <select value={value} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        {OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
