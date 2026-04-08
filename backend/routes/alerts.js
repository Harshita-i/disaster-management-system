const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const SOS = require('../models/SOS');
const { authenticate, authorize } = require('../middleware/auth');

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findSOSInAlertZone(alert) {
  const alertLat = alert.location?.lat;
  const alertLng = alert.location?.lng;

  if (typeof alertLat !== 'number' || typeof alertLng !== 'number') {
    return [];
  }

  const radius = alert.radius || 5000;

  const sosList = await SOS.find({
    status: { $ne: 'resolved' },
    'location.lat': { $ne: null },
    'location.lng': { $ne: null }
  });

  return sosList.filter((sos) => {
    const sosLat = sos.location?.lat;
    const sosLng = sos.location?.lng;

    if (typeof sosLat !== 'number' || typeof sosLng !== 'number') {
      return false;
    }

    return distanceInMeters(sosLat, sosLng, alertLat, alertLng) <= radius;
  });
}

// GET /api/alerts — all alerts (any logged-in user)
router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts — create alert (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type, region, message, severity, location, radius } = req.body;

    if (!type || !region || !message) {
      return res.status(400).json({ message: 'type, region and message are required' });
    }

    const alert = await Alert.create({
      type,
      region,
      message,
      severity,
      location,
      radius
    });

    req.io.to('victim').emit('new-alert', alert);
    req.io.to('ngo').emit('new-alert', alert);

    if (alert.severity === 'critical' && alert.location?.lat != null && alert.location?.lng != null) {
      const affectedSOS = await findSOSInAlertZone(alert);

      for (const sos of affectedSOS) {
        if (sos.priority !== 'red') {
          const updatedSOS = await SOS.findByIdAndUpdate(
            sos._id,
            { priority: 'red' },
            { new: true }
          );

          req.io.to('ngo').emit('sos-updated', { sos: updatedSOS });
          req.io.to('admin').emit('sos-updated', { sos: updatedSOS });
        }
      }
    }

    res.status(201).json({ alert });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create alert', error: err.message });
  }
});

// DELETE /api/alerts/:id — delete alert (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

module.exports = router;