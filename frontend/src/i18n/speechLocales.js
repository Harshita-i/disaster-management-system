/** BCP-47 tags for Web Speech API; browser support varies by locale. */
export const SPEECH_LOCALES = {
  en: 'en-US',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  es: 'es-ES',
  zh: 'zh-CN',
};

function baseLang(i18nLang) {
  if (!i18nLang) return 'en';
  return String(i18nLang).replace(/_/g, '-').split('-')[0].toLowerCase();
}

/**
 * Keywords that trigger Voice SOS (spoken or transcribed).
 * Includes English fallbacks because users often mix languages.
 */
const SOS_KEYWORDS = {
  en: ['help', 'sos', 'danger', 'emergency', 'save me'],
  hi: ['help', 'sos', 'मदद', 'खतरा', 'बचाओ', 'आपात', 'सहायता'],
  te: ['help', 'sos', 'సహాయం', 'అపాయం', 'రక్షించండి', 'ఆపద'],
  ta: ['help', 'sos', 'உதவி', 'ஆபத்து', 'அபாயம்', 'காப்பாற்று'],
  kn: ['help', 'sos', 'ಸಹಾಯ', 'ಅಪಾಯ', 'ರಕ್ಷಿಸಿ', 'ಆಪತ್ತು'],
  es: ['help', 'sos', 'ayuda', 'peligro', 'emergencia', 'socorro'],
  zh: ['help', 'sos', '救命', '帮助', '危险', '紧急', '求助'],
};

export function getSpeechLocale(i18nLang) {
  const b = baseLang(i18nLang);
  return SPEECH_LOCALES[b] || SPEECH_LOCALES.en;
}

export function getSosKeywords(i18nLang) {
  const b = baseLang(i18nLang);
  const primary = SOS_KEYWORDS[b] || SOS_KEYWORDS.en;
  return [...new Set([...primary, ...SOS_KEYWORDS.en])];
}

export function transcriptMatchesSos(transcript, i18nLang) {
  const t = transcript.trim().toLowerCase();
  if (!t) return false;
  return getSosKeywords(i18nLang).some((kw) => {
    const k = kw.toLowerCase();
    return k.length > 0 && t.includes(k);
  });
}
