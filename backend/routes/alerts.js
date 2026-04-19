const express = require('express');
const router  = express.Router();
const Alert   = require('../models/Alert');
const SOS     = require('../models/SOS');
const { authenticate, authorize } = require('../middleware/auth');

function toRadians(v) { return (v * Math.PI) / 180; }

function distanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findSOSInAlertZone(alert) {
  if (!['high', 'critical'].includes(alert.severity)) return [];

  const alertLat = alert.location?.lat;
  const alertLng = alert.location?.lng;
  if (typeof alertLat !== 'number' || typeof alertLng !== 'number') return [];

  const radius  = alert.radius || 5000;
  const sosList = await SOS.find({
    status: { $ne: 'resolved' },
    'location.lat': { $exists: true },
    'location.lng': { $exists: true }
  });

  return sosList.filter(sos => {
    const lat = sos.location?.lat;
    const lng = sos.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    return distanceInMeters(lat, lng, alertLat, alertLng) <= radius;
  });
}

async function updateAllSOSPriorities() {
  const alertZones = await Alert.find({
    severity: { $in: ['high', 'critical'] },
    'location.lat': { $ne: null },
    'location.lng': { $ne: null }
  });

  const allSOS = await SOS.find({ status: { $ne: 'resolved' } });
  const updates = [];

  for (const sos of allSOS) {
    const inZone = alertZones.some((alert) => {
      const distance = distanceInMeters(
        sos.location.lat,
        sos.location.lng,
        alert.location.lat,
        alert.location.lng
      );
      return distance <= (alert.radius || 5000);
    });

    // Must match sos.js updateAllSOSPriorities: red = danger zone OR repeat on same channel (>1)
    const manualN = Number(sos.manualTriggerCount) || 0;
    const voiceN = Number(sos.voiceTriggerCount) || 0;
    const repeatBoost = manualN > 1 || voiceN > 1;
    const newPriority = inZone || repeatBoost ? 'red' : 'yellow';

    if (sos.priority !== newPriority) {
      sos.priority = newPriority;
      updates.push(sos.save());
    }
  }

  await Promise.all(updates);
}

// ─── GET /api/alerts ─────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// ─── POST /api/alerts — admin creates + broadcasts ───────
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type, region, message, severity, location, radius } = req.body;

    if (!type || !region || !message) {
      return res.status(400).json({ message: 'type, region and message are required' });
    }

    const alert = await Alert.create({
      type, region, message, severity,
      location: location || null,
      radius:   radius   || 5000
    });

    // Convert to plain object so location/radius are included in socket payload
    const alertObj = alert.toObject();

    // Broadcast to all roles
    req.io.to('victim').emit('new-alert', alertObj);
    req.io.to('ngo').emit('new-alert', alertObj);
    req.io.to('admin').emit('new-alert', alertObj);

    // Recalculate all active SOS priorities after creating a new alert.
    await updateAllSOSPriorities();
    const updatedSOS = await SOS.find({ status: { $ne: 'resolved' } });
    req.io.to('ngo').emit('sos-list-updated', updatedSOS);
    req.io.to('admin').emit('sos-list-updated', updatedSOS);

    res.status(201).json({ alert: alertObj });
  } catch (err) {
    console.error('Alert creation failed:', err.message);
    res.status(500).json({ message: 'Failed to create alert', error: err.message });
  }
});

// ─── DELETE /api/alerts/:id ───────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    await updateAllSOSPriorities();
    const updatedSOS = await SOS.find({ status: { $ne: 'resolved' } });
    req.io.to('ngo').emit('sos-list-updated', updatedSOS);
    req.io.to('admin').emit('sos-list-updated', updatedSOS);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

module.exports = router;