/**
 * Runtime translation for dynamic alert text.
 * Set LIBRETRANSLATE_URL to a LibreTranslate instance (e.g. docker) for best results.
 * Optional: LIBRETRANSLATE_API_KEY when the server requires it.
 * Falls back to MyMemory (English→target only; weaker for non-English source text).
 */

const LIBRE_BASE = process.env.LIBRETRANSLATE_URL;
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

/** Map app i18n codes to LibreTranslate target codes */
function toLibreTarget(lang) {
  const base = String(lang || 'en').toLowerCase().split(/[-_]/)[0];
  if (base === 'zh') return 'zh';
  return base;
}

/** MyMemory expects e.g. zh-CN for Chinese */
function toMyMemoryTarget(lang) {
  const base = String(lang || 'en').toLowerCase().split(/[-_]/)[0];
  if (base === 'zh') return 'zh-CN';
  return base;
}

async function libreTranslate(text, targetLang, source = 'auto') {
  if (!LIBRE_BASE || !text.trim()) return null;
  const url = `${String(LIBRE_BASE).replace(/\/$/, '')}/translate`;
  const target = toLibreTarget(targetLang);
  try {
    const body = {
      q: text,
      source,
      target,
      format: 'text',
    };
    if (LIBRE_KEY) body.api_key = LIBRE_KEY;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.translatedText === 'string' ? data.translatedText : null;
  } catch (e) {
    console.warn('[translate] LibreTranslate:', e.message);
    return null;
  }
}

async function myMemoryTranslate(text, targetLang) {
  if (!text.trim()) return text;
  const tgt = toMyMemoryTarget(targetLang);
  const pair = `en|${tgt}`;
  const q = text.slice(0, 480);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.responseStatus !== 200) return null;
    const out = data.responseData?.translatedText;
    return typeof out === 'string' && out ? out : null;
  } catch (e) {
    console.warn('[translate] MyMemory:', e.message);
    return null;
  }
}

/**
 * @param {string} text
 * @param {string} targetLang app language code (en, hi, zh, …)
 */
async function translateText(text, targetLang) {
  if (text == null || !String(text).trim()) return text;
  const s = String(text);

  const libre = await libreTranslate(s, targetLang, 'auto');
  if (libre) return libre;

  const mem = await myMemoryTranslate(s, targetLang);
  if (mem) return mem;

  return s;
}

/**
 * @param {string[]} strings
 * @param {string} targetLang
 */
async function translateBatch(strings, targetLang) {
  if (!Array.isArray(strings)) return [];
  return Promise.all(strings.map((s) => translateText(String(s ?? ''), targetLang)));
}

module.exports = { translateText, translateBatch };
