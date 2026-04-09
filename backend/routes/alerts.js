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

    // ── Upgrade victims inside this zone to RED ───────────
    if (
      alertObj.location?.lat != null &&
      alertObj.location?.lng != null
    ) {
      const affectedSOS = await findSOSInAlertZone(alertObj);

      for (const sos of affectedSOS) {
        if (sos.priority !== 'red') {
          const updatedSOS = await SOS.findByIdAndUpdate(
            sos._id,
            { priority: 'red' },
            { new: true }
          );

          const updatedObj = updatedSOS.toObject();

          // Push update to NGO map immediately
          req.io.to('ngo').emit('sos-updated', { sos: updatedObj });
          req.io.to('admin').emit('sos-updated', { sos: updatedObj });

          console.log(`Upgraded SOS ${sos._id} to RED (inside alert zone)`);
        }
      }
    }

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
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

module.exports = router;