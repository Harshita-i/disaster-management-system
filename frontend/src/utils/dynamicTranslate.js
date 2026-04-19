import api from './api';
import i18n from '../i18n/config';

const cache = new Map();
const MAX_CACHE = 400;

function cacheKey(lang, strings) {
  return `${lang}\0${JSON.stringify(strings)}`;
}

i18n.on('languageChanged', () => {
  cache.clear();
});

/**
 * Translate an ordered list of strings into the target UI language (runtime, not static JSON).
 * Results are cached per language + payload.
 */
export async function translateStrings(strings, targetLang) {
  const lang = targetLang || i18n.language || 'en';
  if (!Array.isArray(strings) || strings.length === 0) return [];

  const key = cacheKey(lang, strings);
  if (cache.has(key)) return cache.get(key);

  const res = await api.post('/translate/batch', {
    strings,
    targetLang: lang,
  });
  const out = res.data?.translations || strings;
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, out);
  return out;
}

export function clearTranslateCache() {
  cache.clear();
}
