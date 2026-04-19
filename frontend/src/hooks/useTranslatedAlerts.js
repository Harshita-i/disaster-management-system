import { useState, useEffect, useMemo } from 'react';
import { translateStrings } from '../utils/dynamicTranslate';

/**
 * Keeps alert rows in sync with the current UI language by translating dynamic fields
 * (message, region, type, severity) via the backend.
 */
export function useTranslatedAlerts(alerts, lang) {
  const baseKey = useMemo(
    () =>
      (alerts || [])
        .map((a) => [a._id, a.message, a.region, a.type, a.severity].join('\u0001'))
        .join('\u0002'),
    [alerts]
  );

  const identityRows = useMemo(
    () =>
      (alerts || []).map((a) => ({
        ...a,
        _tr: {
          message: a.message,
          region: a.region,
          type: a.type,
          severity: a.severity,
        },
      })),
    [baseKey]
  );

  const [refined, setRefined] = useState(null);

  useEffect(() => {
    setRefined(null);
    const list = alerts || [];
    if (!list.length) return undefined;

    let cancelled = false;
    const fields = ['message', 'region', 'type', 'severity'];

    (async () => {
      try {
        const allStrings = [];
        list.forEach((a) => {
          fields.forEach((f) => {
            allStrings.push(String(a[f] ?? ''));
          });
        });
        const translations = await translateStrings(allStrings, lang);
        if (cancelled) return;
        const next = list.map((a, i) => {
          const off = i * fields.length;
          return {
            ...a,
            _tr: {
              message: translations[off] ?? a.message,
              region: translations[off + 1] ?? a.region,
              type: translations[off + 2] ?? a.type,
              severity: translations[off + 3] ?? a.severity,
            },
          };
        });
        setRefined(next);
      } catch (e) {
        console.warn('useTranslatedAlerts:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseKey, lang]);

  return refined ?? identityRows;
}
