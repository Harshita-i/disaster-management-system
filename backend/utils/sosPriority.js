/**
 * Open-case priority from danger zones (moderate/high/critical alerts with map location) and repeats.
 * - Resolved cases are not passed here (caller skips them).
 * - Repeat on same channel (manual>1 or voice>1) → always red.
 * - In danger zone: yellow or red → red; green stays green.
 * - Outside zone: red (e.g. was zone-only) → yellow; green stays green; yellow stays yellow.
 */
function priorityFromDangerAndRepeat({
  inDangerZone,
  manualTriggerCount,
  voiceTriggerCount,
  previousPriority,
}) {
  const manualN = Number(manualTriggerCount) || 0;
  const voiceN = Number(voiceTriggerCount) || 0;
  const repeatBoost = manualN > 1 || voiceN > 1;

  const prev = ['red', 'yellow', 'green'].includes(previousPriority)
    ? previousPriority
    : 'yellow';

  if (repeatBoost) return 'red';
  if (inDangerZone) {
    if (prev === 'green') return 'green';
    return 'red';
  }
  if (prev === 'green') return 'green';
  if (prev === 'red') return 'yellow';
  return 'yellow';
}

module.exports = { priorityFromDangerAndRepeat };
