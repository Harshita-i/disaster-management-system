import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const goLight = theme === 'dark';

  return (
    <button
      type="button"
      className={['theme-toggle', className].filter(Boolean).join(' ')}
      onClick={toggleTheme}
      aria-pressed={theme === 'light'}
      aria-label={goLight ? t('common.themeUseLight') : t('common.themeUseDark')}
      title={goLight ? t('common.themeUseLight') : t('common.themeUseDark')}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {goLight ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
