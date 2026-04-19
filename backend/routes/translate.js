const express = require('express');
const { authenticate } = require('../middleware/auth');
const { translateBatch } = require('../services/translate');

const router = express.Router();

const MAX_STRINGS = 48;
const MAX_LEN = 2500;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 80;

const rateByUser = new Map();

function allowTranslate(userId) {
  const now = Date.now();
  let e = rateByUser.get(userId);
  if (!e || now - e.start > RATE_WINDOW_MS) {
    e = { start: now, count: 0 };
  }
  e.count += 1;
  rateByUser.set(userId, e);
  return e.count <= RATE_MAX;
}

router.post('/batch', authenticate, async (req, res) => {
  try {
    const userId = String(req.user?.id || 'anon');
    if (!allowTranslate(userId)) {
      return res.status(429).json({ message: 'Too many translation requests. Try again shortly.' });
    }

    const { strings, targetLang } = req.body || {};
    if (!Array.isArray(strings) || typeof targetLang !== 'string' || !targetLang.trim()) {
      return res.status(400).json({ message: 'Body must include strings: string[] and targetLang: string' });
    }

    const safe = strings
      .slice(0, MAX_STRINGS)
      .map((s) => String(s ?? '').slice(0, MAX_LEN));

    const translations = await translateBatch(safe, targetLang.trim());
    res.json({ translations });
  } catch (err) {
    console.error('POST /translate/batch', err);
    res.status(500).json({ message: 'Translation failed' });
  }
});

module.exports = router;
