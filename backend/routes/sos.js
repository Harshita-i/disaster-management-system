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

function computeTrustAndScores({
  inDangerZone,
  triggerCount,
  triggerSource,
  message,
  priority,
}) {
  let trust = 65;
  if (inDangerZone) trust += 22;
  if (triggerSource === 'voice') trust += 7;
  const msg = String(message || '').trim();
  if (msg.length > 14) trust += 6;
  trust -= Math.min(28, Math.max(0, triggerCount - 1) * 5);
  trust = Math.round(Math.max(28, Math.min(99, trust)));

  const suspicious = trust < 46 || triggerCount > 13;
  const unverifiedCritical = priority === 'red' && trust < 58;

  let priorityScore = 42;
  if (priority === 'red') priorityScore += 38;
  else if (priority === 'yellow') priorityScore += 18;
  else priorityScore += 6;
  if (inDangerZone) priorityScore += 12;
  priorityScore += Math.min(12, Math.max(0, triggerCount - 1) * 3);
  priorityScore = Math.round(Math.min(100, Math.max(0, priorityScore)));

  return { trustScore: trust, priorityScore, suspicious, unverifiedCritical };
}

async function getDangerAlerts() {
  return Alert.find({
    severity: { $in: ['high', 'critical'] },
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
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

function sosInAnyZone(sosLat, sosLng, alertZones) {
  return alertZones.some((alert) => {
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

    const distance = distanceInMeters(sosLat, sosLng, alertLat, alertLng);
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

    const inZone = sosInAnyZone(sosLat, sosLng, alertZones);

    const tc =
      sos.triggerCount != null
        ? sos.triggerCount
        : Math.max(1, sos.manualTriggerCount || 1);
    const repeatBoost = tc > 1;
    const newPriority = inZone || repeatBoost ? 'red' : 'yellow';

    if (sos.priority !== newPriority) {
      sos.priority = newPriority;
      updates.push(sos.save());
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  const updatedSOS = await SOS.find({ status: { $ne: 'resolved' } })
    .populate('assignedTo', 'name ngoName location')
    .sort({ createdAt: -1 });
  io.to('ngo').emit('sos-list-updated', updatedSOS);
  io.to('admin').emit('sos-list-updated', updatedSOS);
}

/**
 * Pick nearest / least-loaded NGO. Uses SOS priorityScore so critical calls weight distance more.
 */
async function findBestNgoForSos(lat, lng, sosPriorityScore) {
  const ngos = await User.find({
    role: 'ngo',
    approved: true,
    blocked: { $ne: true },
    'location.lat': { $exists: true, $ne: null },
    'location.lng': { $exists: true, $ne: null },
  }).select('_id name ngoName location');

  if (!ngos.length) return null;

  const loads = await Promise.all(
    ngos.map(async (n) => {
      const open = await SOS.countDocuments({
        assignedTo: n._id,
        status: { $in: ['assigned', 'in-progress'] },
      });
      return { ngo: n, open };
    })
  );

  const urgencyWeight = Math.min(1, (Number(sosPriorityScore) || 50) / 100);
  const distBoost = 0.35 + urgencyWeight * 0.25;

  let best = null;
  let bestScore = -Infinity;

  for (const { ngo, open } of loads) {
    const d = distanceInMeters(lat, lng, ngo.location.lat, ngo.location.lng);
    if (!Number.isFinite(d)) continue;

    const distKm = d / 1000;
    const distanceScore = 100 / (1 + distKm * 0.55);
    const availabilityScore = 100 / (1 + open * 12);
    const score =
      distanceScore * distBoost +
      availabilityScore * (0.95 - distBoost * 0.35) +
      (Number(sosPriorityScore) || 50) * 0.08;

    if (score > bestScore) {
      bestScore = score;
      best = ngo;
    }
  }

  return best;
}

async function tryAutoAssignSos(io, sosDoc) {
  if (!sosDoc || sosDoc.status !== 'pending' || sosDoc.assignedTo) {
    return sosDoc;
  }

  const lat = Number(sosDoc.location?.lat);
  const lng = Number(sosDoc.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return sosDoc;

  const ngo = await findBestNgoForSos(lat, lng, sosDoc.priorityScore);
  if (!ngo) return sosDoc;

  const label = ngo.ngoName || ngo.name || 'A rescue team';

  const updated = await SOS.findByIdAndUpdate(
    sosDoc._id,
    { assignedTo: ngo._id, status: 'assigned', autoAssigned: true },
    { new: true }
  ).populate('assignedTo', 'name ngoName location');

  io.to('victim').emit('sos-update', {
    sosId: updated._id,
    status: 'assigned',
    message: `${label} has been assigned to you.`,
  });

  io.to('ngo').emit('sos-assigned', { sosId: updated._id, assignedTo: ngo._id });
  io.to('admin').emit('sos-assigned', { sosId: updated._id, assignedTo: ngo._id });

  return updated;
}

async function loadSosPopulated(id) {
  return SOS.findById(id).populate('assignedTo', 'name ngoName location');
}

// ─── POST /api/sos — victim triggers SOS ─────────────────
router.post('/', authenticate, authorize('victim'), async (req, res) => {
  try {
    const { lat, lng, message } = req.body;
    const triggerSource = req.body.source === 'voice' ? 'voice' : 'manual';

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
      status: { $ne: 'resolved' },
    }).sort({ createdAt: -1 });

    const inDangerZone = await isInsideDangerZone(latNum, lngNum);

    let triggerCount;
    let manualTriggerCount;

    if (existingOpenSOS) {
      const prevTc =
        existingOpenSOS.triggerCount != null
          ? existingOpenSOS.triggerCount
          : Math.max(1, existingOpenSOS.manualTriggerCount || 1);
      triggerCount = prevTc + 1;
      manualTriggerCount =
        triggerSource === 'manual'
          ? (existingOpenSOS.manualTriggerCount || 0) + 1
          : existingOpenSOS.manualTriggerCount || 0;
    } else {
      triggerCount = 1;
      manualTriggerCount = triggerSource === 'manual' ? 1 : 0;
    }

    const priority = inDangerZone || triggerCount > 1 ? 'red' : 'yellow';

    const scores = computeTrustAndScores({
      inDangerZone,
      triggerCount,
      triggerSource,
      message,
      priority,
    });

    const baseUpdate = {
      priority,
      triggerCount,
      manualTriggerCount,
      trustScore: scores.trustScore,
      priorityScore: scores.priorityScore,
      suspicious: scores.suspicious,
      unverifiedCritical: scores.unverifiedCritical,
      location: { lat: latNum, lng: lngNum },
      ...(message !== undefined ? { message: message || '' } : {}),
    };

    let sos;

    if (existingOpenSOS) {
      sos = await SOS.findByIdAndUpdate(existingOpenSOS._id, baseUpdate, {
        returnDocument: 'after',
      });

      await updateAllSOSPriorities(req.io);

      sos = await loadSosPopulated(sos._id);
      sos = await tryAutoAssignSos(req.io, sos);

      req.io.to('ngo').emit('sos-updated', { sos });
      req.io.to('admin').emit('sos-updated', { sos });

      return res.status(200).json({
        message: 'SOS updated successfully',
        sos,
      });
    }

    sos = await SOS.create({
      userId: req.user.id,
      name: user.name,
      location: { lat: latNum, lng: lngNum },
      priority,
      ...baseUpdate,
      message: message || '',
    });

    await updateAllSOSPriorities(req.io);

    sos = await loadSosPopulated(sos._id);
    sos = await tryAutoAssignSos(req.io, sos);

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

    const sosList = await SOS.find(filter)
      .populate('assignedTo', 'name ngoName location')
      .sort({ createdAt: -1 });

    const uniqueByUser = new Map();
    for (const sos of sosList) {
      const key = String(sos.userId || sos._id);
      if (!uniqueByUser.has(key)) {
        uniqueByUser.set(key, sos);
      }
    }

    const deduped = Array.from(uniqueByUser.values());

    const priorityWeight = { red: 1, yellow: 2, green: 3 };
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
      userId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name ngoName location');

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

    if (targetSOS.assignedTo) {
      return res.status(400).json({
        message: 'This SOS is already assigned to a rescue team.',
      });
    }

    if (targetSOS.priority === 'yellow') {
      const redPending = await SOS.findOne({
        priority: 'red',
        status: 'pending',
      });

      if (redPending) {
        return res.status(400).json({
          message:
            'Cannot assign — critical (Red) victims are waiting. Handle them first.',
          blockingId: redPending._id,
        });
      }
    }

    if (targetSOS.status !== 'pending') {
      return res.status(400).json({ message: 'This SOS is already being handled' });
    }

    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { assignedTo: req.user.id, status: 'assigned', autoAssigned: false },
      { new: true }
    ).populate('assignedTo', 'name ngoName location');

    req.io.to('victim').emit('sos-update', {
      sosId: sos._id,
      status: 'assigned',
      message: 'A rescue team has been assigned to you',
    });

    req.io.to('ngo').emit('sos-assigned', { sosId: sos._id, assignedTo: req.user.id });
    req.io.to('admin').emit('sos-assigned', { sosId: sos._id, assignedTo: req.user.id });
    req.io.to('ngo').emit('sos-updated', { sos });
    req.io.to('admin').emit('sos-updated', { sos });

    return res.json({ message: 'SOS assigned successfully', sos });
  } catch (err) {
    return res.status(500).json({ message: 'Assignment failed', error: err.message });
  }
});

// ─── POST /api/sos/:id/status — NGO/admin updates status ───────
router.post('/:id/status', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const existing = await SOS.findById(req.params.id).populate('assignedTo', 'name ngoName location');
    if (!existing) {
      return res.status(404).json({ message: 'SOS not found' });
    }

    if (req.user.role === 'ngo') {
      const aid = existing.assignedTo?._id || existing.assignedTo;
      if (!aid || String(aid) !== String(req.user.id)) {
        return res.status(403).json({
          message: 'Only the assigned rescue team can update this SOS.',
        });
      }
    }

    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('assignedTo', 'name ngoName location');

    if (status !== 'resolved') {
      await updateAllSOSPriorities(req.io);
    }

    req.io.to('victim').emit('sos-update', { sosId: sos._id, status });
    req.io.to('ngo').emit('sos-status-updated', { sosId: sos._id, status });
    req.io.to('admin').emit('sos-status-updated', { sosId: sos._id, status });
    req.io.to('ngo').emit('sos-updated', { sos });
    req.io.to('admin').emit('sos-updated', { sos });

    return res.json({ message: 'Status updated', sos });
  } catch (err) {
    return res.status(500).json({ message: 'Status update failed' });
  }
});

module.exports = router;
