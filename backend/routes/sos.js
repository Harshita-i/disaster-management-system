const express = require('express');
const router = express.Router();
const SOS = require('../models/SOS');
const User = require('../models/User');
const Alert = require('../models/Alert');
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

async function getDangerAlerts() {
  return Alert.find({
    severity: { $in: ['high', 'critical'] },
    'location.lat': { $ne: null },
    'location.lng': { $ne: null }
  });
}

async function isInsideDangerZone(lat, lng) {
  const dangerAlerts = await getDangerAlerts();

  return dangerAlerts.some((alert) => {
    const alertLat = Number(alert.location.lat);
    const alertLng = Number(alert.location.lng);
    const radius = Number(alert.radius) || 5000;

    if (
      !Number.isFinite(alertLat) ||
      !Number.isFinite(alertLng) ||
      !Number.isFinite(radius)
    ) {
      return false;
    }

    const distance = distanceInMeters(lat, lng, alertLat, alertLng);
    return distance <= radius;
  });
}

async function updateAllSOSPriorities(io) {
  const alertZones = await getDangerAlerts();

  const allSOS = await SOS.find({ status: { $ne: 'resolved' } });

  const updates = [];

  for (const sos of allSOS) {
    const sosLat = Number(sos?.location?.lat);
    const sosLng = Number(sos?.location?.lng);

    if (!Number.isFinite(sosLat) || !Number.isFinite(sosLng)) {
      continue;
    }

    const inZone = alertZones.some((alert) => {
      const alertLat = Number(alert.location.lat);
      const alertLng = Number(alert.location.lng);
      const radius = Number(alert.radius) || 5000;

      if (
        !Number.isFinite(alertLat) ||
        !Number.isFinite(alertLng) ||
        !Number.isFinite(radius)
      ) {
        return false;
      }

      const distance = distanceInMeters(
        sosLat,
        sosLng,
        alertLat,
        alertLng
      );

      return distance <= radius;
    });

    const newPriority = inZone ? 'red' : 'yellow';

    if (sos.priority !== newPriority) {
      sos.priority = newPriority;
      updates.push(sos.save());
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  const updatedSOS = await SOS.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
  io.to('ngo').emit('sos-list-updated', updatedSOS);
  io.to('admin').emit('sos-list-updated', updatedSOS);
}

// ─── POST /api/sos — victim triggers SOS ─────────────────
router.post('/', authenticate, authorize('victim'), async (req, res) => {
  try {
    const { lat, lng, message, source } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'Location is required' });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    const user = await User.findById(req.user.id).select('name');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingOpenSOS = await SOS.findOne({
      userId: req.user.id,
      status: { $ne: 'resolved' }
    }).sort({ createdAt: -1 });

    const inDangerZone = await isInsideDangerZone(latNum, lngNum);
    const priority = inDangerZone ? 'red' : 'yellow';

    if (existingOpenSOS) {
      const updatedSOS = await SOS.findByIdAndUpdate(
        existingOpenSOS._id,
        {
          priority,
          location: { lat: latNum, lng: lngNum },
          ...(message !== undefined ? { message: message || '' } : {}),
          ...(source !== undefined ? { source } : {})
        },
        { returnDocument: 'after' }
      );

      await updateAllSOSPriorities(req.io);

      req.io.to('ngo').emit('sos-updated', { sos: updatedSOS });
      req.io.to('admin').emit('sos-updated', { sos: updatedSOS });

      return res.status(200).json({
        message: 'SOS updated successfully',
        sos: updatedSOS
      });
    }

    const sos = await SOS.create({
      userId: req.user.id,
      name: user.name,
      location: { lat: latNum, lng: lngNum },
      priority,
      message: message || '',
      ...(source !== undefined ? { source } : {})
    });

    await updateAllSOSPriorities(req.io);

    req.io.to('ngo').emit('new-sos', sos);
    req.io.to('admin').emit('new-sos', sos);

    return res.status(201).json({ message: 'SOS sent successfully', sos });
  } catch (err) {
    return res.status(500).json({ message: 'SOS failed', error: err.message });
  }
});

// ─── GET /api/sos — NGO/admin gets all SOS ───────────────
router.get('/', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (!req.query.showAll) {
      filter.status = { $ne: 'resolved' };
    }

    const sosList = await SOS.find(filter).sort({ createdAt: -1 });

    const uniqueByUser = new Map();
    for (const sos of sosList) {
      const key = String(sos.userId || sos._id);
      if (!uniqueByUser.has(key)) {
        uniqueByUser.set(key, sos);
      }
    }

    const deduped = Array.from(uniqueByUser.values());

    const priorityWeight = { red: 1, yellow: 2 };
    deduped.sort((a, b) => {
      const pa = priorityWeight[a.priority] || 99;
      const pb = priorityWeight[b.priority] || 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return res.json(deduped);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch SOS list' });
  }
});

// ─── GET /api/sos/my — victim checks own status ──────────
router.get('/my', authenticate, authorize('victim'), async (req, res) => {
  try {
    const sos = await SOS.findOne({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    if (!sos) {
      return res.json({ status: null });
    }

    return res.json(sos);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch status' });
  }
});

// ─── POST /api/sos/:id/assign — NGO accepts request ──────
router.post('/:id/assign', authenticate, authorize('ngo'), async (req, res) => {
  try {
    const targetSOS = await SOS.findById(req.params.id);

    if (!targetSOS) {
      return res.status(404).json({ message: 'SOS not found' });
    }

    if (targetSOS.priority === 'yellow') {
      const redPending = await SOS.findOne({
        priority: 'red',
        status: 'pending'
      });

      if (redPending) {
        return res.status(400).json({
          message: 'Cannot assign — critical (Red) victims are waiting. Handle them first.',
          blockingId: redPending._id
        });
      }
    }

    if (targetSOS.status !== 'pending') {
      return res.status(400).json({ message: 'This SOS is already being handled' });
    }

    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { assignedTo: req.user.id, status: 'assigned' },
      { returnDocument: 'after' }
    );

    req.io.to('victim').emit('sos-update', {
      sosId: sos._id,
      status: 'assigned',
      message: 'A rescue team has been assigned to you'
    });

    req.io.to('ngo').emit('sos-assigned', { sosId: sos._id });
    req.io.to('admin').emit('sos-assigned', { sosId: sos._id });

    return res.json({ message: 'SOS assigned successfully', sos });
  } catch (err) {
    return res.status(500).json({ message: 'Assignment failed', error: err.message });
  }
});

// ─── POST /api/sos/:id/status — NGO/admin updates status ───────
router.post('/:id/status', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' }
    );

    if (!sos) {
      return res.status(404).json({ message: 'SOS not found' });
    }

    if (status !== 'resolved') {
      await updateAllSOSPriorities(req.io);
    }

    req.io.to('victim').emit('sos-update', { sosId: sos._id, status });
    req.io.to('ngo').emit('sos-status-updated', { sosId: sos._id, status });
    req.io.to('admin').emit('sos-status-updated', { sosId: sos._id, status });

    return res.json({ message: 'Status updated', sos });
  } catch (err) {
    return res.status(500).json({ message: 'Status update failed' });
  }
});

module.exports = router;