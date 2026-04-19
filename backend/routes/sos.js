const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const SOS = require('../models/SOS');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { authenticate, authorize } = require('../middleware/auth');

/** Active SLA timers: if assigned → not in-progress within window, reassign */
const sosResponseTimers = new Map();

function getResponseTimeoutMinutes() {
  const raw = Number(process.env.SOS_RESPONSE_TIMEOUT_MINUTES);
  const n = Number.isFinite(raw) && raw > 0 ? raw : 8;
  return Math.min(10, Math.max(5, n));
}

function clearSosResponseTimer(sosId) {
  const sid = String(sosId);
  const h = sosResponseTimers.get(sid);
  if (h) clearTimeout(h);
  sosResponseTimers.delete(sid);
}

function scheduleSosResponseTimer(io, sosId, delayMsOverride) {
  clearSosResponseTimer(sosId);
  const fullWindow = getResponseTimeoutMinutes() * 60 * 1000;
  const delay =
    delayMsOverride != null && Number.isFinite(Number(delayMsOverride))
      ? Math.min(fullWindow, Math.max(1000, Math.floor(Number(delayMsOverride))))
      : fullWindow;
  const handle = setTimeout(() => {
    processSosResponseDeadline(io, sosId).catch((err) =>
      console.error('[SOS] response deadline:', err.message)
    );
  }, delay);
  sosResponseTimers.set(String(sosId), handle);
}

/**
 * In-memory timers are lost on nodemon/server restart. Use assignedAt in the DB
 * to find overdue "assigned" SOS and run the same deadline handler; reschedule
 * remaining time if a row is still inside the window but has no live timer.
 */
async function reconcileAssignedSla(io) {
  if (!io) return;
  const windowMs = getResponseTimeoutMinutes() * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  const rows = await SOS.find({
    status: 'assigned',
    assignedTo: { $ne: null },
  })
    .select('_id assignedAt')
    .lean();

  for (const row of rows) {
    const id = row._id;
    const startMs = row.assignedAt ? new Date(row.assignedAt).getTime() : 0;
    const overdue = !row.assignedAt || startMs <= cutoff;

    if (overdue) {
      await processSosResponseDeadline(io, id);
      continue;
    }

    const remaining = startMs + windowMs - Date.now();
    if (remaining > 1500 && !sosResponseTimers.has(String(id))) {
      scheduleSosResponseTimer(io, id, remaining);
    }
  }
}

function clampScore(x) {
  return Math.max(0, Math.min(100, x));
}

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

    const manualN = Number(sos.manualTriggerCount) || 0;
    const voiceN = Number(sos.voiceTriggerCount) || 0;
    const repeatBoost = manualN > 1 || voiceN > 1;
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
 * Weighted NGO pick (0–100 subscores):
 * assignmentScore =
 *   distance*0.35 + availability*0.20 + workload*0.15 + capability*0.15 + reliability*0.10 + region*0.05
 */
async function findBestNgoForSos(lat, lng, sosPriorityScore, excludeIds = []) {
  const excludeOid = (excludeIds || [])
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const query = {
    role: 'ngo',
    approved: true,
    blocked: { $ne: true },
  };
  if (excludeOid.length) {
    query._id = { $nin: excludeOid };
  }

  const ngos = await User.find(query).select('_id name ngoName location');

  if (!ngos.length) return null;

  const victimLat = Number(lat);
  const victimLng = Number(lng);
  const hasVictim = Number.isFinite(victimLat) && Number.isFinite(victimLng);

  const scored = await Promise.all(
    ngos.map(async (n) => {
      const open = await SOS.countDocuments({
        assignedTo: n._id,
        status: { $in: ['assigned', 'in-progress'] },
      });
      const inProg = await SOS.countDocuments({
        assignedTo: n._id,
        status: 'in-progress',
      });
      const resolvedCount = await SOS.countDocuments({
        assignedTo: n._id,
        status: 'resolved',
      });

      let distKm = NaN;
      if (hasVictim && n.location?.lat != null && n.location?.lng != null) {
        const d = distanceInMeters(victimLat, victimLng, n.location.lat, n.location.lng);
        if (Number.isFinite(d)) distKm = d / 1000;
      }

      let distanceScore = 55;
      if (Number.isFinite(distKm)) {
        distanceScore = clampScore(100 / (1 + distKm * 0.065));
      }

      const availabilityScore = clampScore(100 / (1 + open * 3.5));

      const workloadStress = open * 11 + inProg * 16;
      const workloadScore = clampScore(100 - Math.min(92, workloadStress));

      const capabilityScore = clampScore(
        76 + (n.ngoName ? 10 : 0) + Math.min(14, resolvedCount * 0.35)
      );

      const reliabilityScore = clampScore(
        resolvedCount < 1 ? 68 : 55 + Math.min(40, resolvedCount * 2.2)
      );

      let regionScore = 58;
      if (Number.isFinite(distKm)) {
        if (distKm < 75) regionScore = 100;
        else if (distKm < 220) regionScore = 78;
        else regionScore = clampScore(95 - distKm / 12);
      }

      const assignmentScore =
        distanceScore * 0.35 +
        availabilityScore * 0.2 +
        workloadScore * 0.15 +
        capabilityScore * 0.15 +
        reliabilityScore * 0.1 +
        regionScore * 0.05;

      return { ngo: n, assignmentScore, open };
    })
  );

  scored.sort((a, b) => {
    if (b.assignmentScore !== a.assignmentScore) return b.assignmentScore - a.assignmentScore;
    if (a.open !== b.open) return a.open - b.open;
    return String(a.ngo._id).localeCompare(String(b.ngo._id));
  });

  return scored[0].ngo;
}

/**
 * Release current assignee (must match prevId), exclude them from immediate re-pick,
 * notify, then auto-assign next best NGO if any.
 */
async function executeReleaseAndReassign(io, sosId, prevId, reassignmentReason, victimMessage) {
  clearSosResponseTimer(sosId);

  const sos = await SOS.findById(sosId);
  if (!sos || sos.status !== 'assigned') return;

  const current = sos.assignedTo;
  if (!current || String(current) !== String(prevId)) return;

  const ex = new Set((sos.reassignmentExcludeIds || []).map(String));
  ex.add(String(prevId));
  const excludeArr = Array.from(ex)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .slice(0, 15)
    .map((id) => new mongoose.Types.ObjectId(id));

  await SOS.findByIdAndUpdate(sosId, {
    assignedTo: null,
    status: 'pending',
    autoAssigned: false,
    assignedAt: null,
    reassignmentExcludeIds: excludeArr,
    $push: {
      reassignmentEvents: {
        at: new Date(),
        fromNgo: prevId,
        reason: reassignmentReason,
      },
    },
  });

  const pendingDoc = await loadSosPopulated(sosId);
  io.to('victim').emit('sos-update', {
    sosId: pendingDoc._id,
    status: 'pending',
    message: victimMessage,
  });
  io.to('ngo').emit('sos-reassignment-timeout', {
    sosId: String(sosId),
    previousNgoId: String(prevId),
    reason: reassignmentReason,
  });
  io.to('admin').emit('sos-reassignment-timeout', {
    sosId: String(sosId),
    previousNgoId: String(prevId),
    reason: reassignmentReason,
  });
  io.to('ngo').emit('sos-updated', { sos: pendingDoc });
  io.to('admin').emit('sos-updated', { sos: pendingDoc });

  const lat = Number(pendingDoc.location?.lat);
  const lng = Number(pendingDoc.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    await updateAllSOSPriorities(io);
    return;
  }

  const next = await findBestNgoForSos(lat, lng, pendingDoc.priorityScore, excludeArr);
  if (!next) {
    await updateAllSOSPriorities(io);
    return;
  }

  const label = next.ngoName || next.name || 'A rescue team';
  const reassigned = await SOS.findByIdAndUpdate(
    sosId,
    {
      assignedTo: next._id,
      status: 'assigned',
      autoAssigned: true,
      assignedAt: new Date(),
    },
    { new: true }
  ).populate('assignedTo', 'name ngoName location');

  scheduleSosResponseTimer(io, reassigned._id);

  io.to('victim').emit('sos-update', {
    sosId: reassigned._id,
    status: 'assigned',
    message: `${label} is now assigned to you.`,
  });
  io.to('ngo').emit('sos-assigned', { sosId: reassigned._id, assignedTo: next._id });
  io.to('admin').emit('sos-assigned', { sosId: reassigned._id, assignedTo: next._id });
  io.to('ngo').emit('sos-updated', { sos: reassigned });
  io.to('admin').emit('sos-updated', { sos: reassigned });
  await updateAllSOSPriorities(io);
}

async function processSosResponseDeadline(io, sosId) {
  const sos = await SOS.findById(sosId).select('status assignedTo');
  if (!sos || sos.status !== 'assigned' || !sos.assignedTo) {
    clearSosResponseTimer(sosId);
    return;
  }
  const victimMsg =
    'Your assigned team did not move the rescue to in-progress in time. Another team will be selected.';
  await executeReleaseAndReassign(io, sosId, sos.assignedTo, 'response_timeout', victimMsg);
}

async function tryAutoAssignSos(io, sosDoc) {
  if (!sosDoc || sosDoc.status !== 'pending' || sosDoc.assignedTo) {
    return sosDoc;
  }

  const lat = Number(sosDoc.location?.lat);
  const lng = Number(sosDoc.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return sosDoc;

  const exclude = (sosDoc.reassignmentExcludeIds || []).map((id) => String(id));
  const ngo = await findBestNgoForSos(lat, lng, sosDoc.priorityScore, exclude);
  if (!ngo) return sosDoc;

  const label = ngo.ngoName || ngo.name || 'A rescue team';

  const updated = await SOS.findByIdAndUpdate(
    sosDoc._id,
    {
      assignedTo: ngo._id,
      status: 'assigned',
      autoAssigned: true,
      assignedAt: new Date(),
    },
    { new: true }
  ).populate('assignedTo', 'name ngoName location');

  scheduleSosResponseTimer(io, updated._id);

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
    let voiceTriggerCount;

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
      voiceTriggerCount =
        triggerSource === 'voice'
          ? (existingOpenSOS.voiceTriggerCount || 0) + 1
          : existingOpenSOS.voiceTriggerCount || 0;
    } else {
      triggerCount = 1;
      manualTriggerCount = triggerSource === 'manual' ? 1 : 0;
      voiceTriggerCount = triggerSource === 'voice' ? 1 : 0;
    }

    // Yellow: first manual only (≤1) and/or first voice only (≤1) while outside admin danger zones.
    // Red: inside a high/critical alert radius, OR more than one manual press, OR more than one voice send.
    const forceRed =
      inDangerZone || manualTriggerCount > 1 || voiceTriggerCount > 1;
    const priority = forceRed ? 'red' : 'yellow';

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
      voiceTriggerCount,
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
      {
        assignedTo: req.user.id,
        status: 'assigned',
        autoAssigned: false,
        assignedAt: new Date(),
      },
      { new: true }
    ).populate('assignedTo', 'name ngoName location');

    scheduleSosResponseTimer(req.io, sos._id);

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

// ─── POST /api/sos/:id/pass-busy — assigned NGO: busy, pass to another team ─
router.post('/:id/pass-busy', authenticate, authorize('ngo'), async (req, res) => {
  try {
    const sos = await SOS.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'SOS not found' });
    }
    if (sos.status !== 'assigned') {
      return res.status(400).json({ message: 'This SOS is not in an assigned state.' });
    }
    const assignedId = sos.assignedTo ? String(sos.assignedTo) : '';
    if (!assignedId || assignedId !== String(req.user.id)) {
      return res.status(403).json({
        message: 'Only the currently assigned team can pass this SOS.',
      });
    }

    const victimMsg =
      'Your assigned team signalled they are busy right now. The system is selecting another responder.';
    await executeReleaseAndReassign(req.io, sos._id, req.user.id, 'ngo_busy', victimMsg);

    const fresh = await loadSosPopulated(req.params.id);
    return res.json({
      message: 'Case released. Another team may have been assigned if one is available.',
      sos: fresh,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Could not pass SOS', error: err.message });
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

    if (status === 'in-progress' || status === 'resolved') {
      clearSosResponseTimer(req.params.id);
    }

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

/** Call once after HTTP server + Socket.IO are up (e.g. from server.js). */
router.startSosSlaReconciler = function startSosSlaReconciler(io) {
  const tick = () => reconcileAssignedSla(io).catch((err) => console.error('[SOS SLA]', err.message));
  tick();
  const handle = setInterval(tick, 60 * 1000);
  return handle;
};

module.exports = router;
