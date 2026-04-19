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

  const selectStyle =
    variant === 'light'
      ? {
          padding: compact ? '8px 10px' : '10px 12px',
          borderRadius: 12,
          border: '1.5px solid #e2e8f0',
          background: '#f8fafc',
          color: '#0f172a',
          fontSize: compact ? 13 : 14,
          maxWidth: compact ? 200 : 220,
          cursor: 'pointer',
        }
      : {
          padding: compact ? '6px 10px' : '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(148, 163, 184, 0.45)',
          background: 'rgba(15, 23, 42, 0.35)',
          color: 'inherit',
          fontSize: compact ? 12 : 13,
          maxWidth: compact ? 170 : 200,
          cursor: 'pointer',
        };

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        fontSize: compact ? 12 : 13,
        color: 'inherit',
      }}
    >
      <span style={{ opacity: variant === 'light' ? 0.75 : 0.85 }}>{t('common.language')}</span>
      <select value={value} onChange={(e) => i18n.changeLanguage(e.target.value)} style={selectStyle}>
        {OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
