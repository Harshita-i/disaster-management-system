import i18n from '../i18n/config';

/**
 * Surface a new disaster alert in the user's current UI language:
 * translates dynamic fields, uses localized labels, then Web Notification if
 * permitted, otherwise window.alert.
 */
export async function showMultilingualNewAlert(alert, translateStrings) {
  const lang = i18n.language || 'en';
  const title = i18n.t('alert.browserTitle');

  const raw = [
    String(alert.type ?? ''),
    String(alert.region ?? ''),
    String(alert.message ?? ''),
    String(alert.severity ?? ''),
  ];

  let typeT = raw[0];
  let regionT = raw[1];
  let messageT = raw[2];
  let severityT = raw[3];

  try {
    const tr = await translateStrings(raw, lang);
    typeT = tr[0] ?? raw[0];
    regionT = tr[1] ?? raw[1];
    messageT = tr[2] ?? raw[2];
    severityT = tr[3] ?? raw[3];
  } catch {
    /* keep English/source strings */
  }

  const typeLabel = i18n.t('alert.type');
  const regionLabel = i18n.t('alert.region');
  const severityLabel = i18n.t('alert.severity');
  const messageLabel = i18n.t('alert.messageLabel');

  const body = [
    `${typeLabel}: ${typeT}`,
    `${regionLabel}: ${regionT}`,
    `${severityLabel}: ${severityT}`,
    `${messageLabel}: ${messageT}`,
  ].join('\n');

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag: `crisis-alert-${String(alert._id ?? '')}`,
        requireInteraction: alert.severity === 'critical' || alert.severity === 'high',
      });
      return;
    } catch {
      /* fall through to dialog */
    }
  }

  window.alert(`${title}\n\n${body}`);
}
