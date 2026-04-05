const express = require('express');
const router = express.Router();
const SOS = require('../models/SOS');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

// ─── POST /api/sos — victim triggers SOS ─────────────────
router.post('/', authenticate, authorize('victim'), async (req, res) => {
  try {
    const { lat, lng, message } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Location is required' });
    }

    const user = await User.findById(req.user.id).select('name');

    // Simple priority rule (replace with ML later)
    // If victim has an unresolved SOS already → Red
    const existing = await SOS.findOne({ 
      userId: req.user.id, 
      status: { $ne: 'resolved' } 
    });
    const priority = existing ? 'red' : 'yellow';

    const sos = await SOS.create({
      userId:   req.user.id,
      name:     user.name,
      location: { lat, lng },
      priority,
      message:  message || ''
    });

    // Broadcast to all NGOs and admins via Socket.io
    req.io.to('ngo').emit('new-sos', sos);
    req.io.to('admin').emit('new-sos', sos);

    res.status(201).json({ 
      message: 'SOS sent successfully', 
      sos 
    });
  } catch (err) {
    res.status(500).json({ message: 'SOS failed', error: err.message });
  }
});

// ─── GET /api/sos — NGO/admin gets all SOS ───────────────
router.get('/', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const sosList = await SOS.find(filter).sort({ createdAt: -1 });
    res.json(sosList);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch SOS list' });
  }
});

// ─── GET /api/sos/my — victim checks own status ──────────
router.get('/my', authenticate, authorize('victim'), async (req, res) => {
  try {
    const sos = await SOS.findOne({ 
      userId: req.user.id 
    }).sort({ createdAt: -1 });

    if (!sos) return res.json({ status: null });
    res.json(sos);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch status' });
  }
});

// ─── POST /api/sos/:id/assign — NGO accepts request ──────
router.post('/:id/assign', authenticate, authorize('ngo'), async (req, res) => {
  try {
    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { 
        assignedTo: req.user.id, 
        status: 'assigned' 
      },
      { new: true }
    );

    if (!sos) return res.status(404).json({ message: 'SOS not found' });

    // Notify the victim their SOS was accepted
    req.io.to('victim').emit('sos-update', {
      sosId:  sos._id,
      status: 'assigned',
      message: 'A rescue team has been assigned to you'
    });

    // Notify other NGOs this case is taken
    req.io.to('ngo').emit('sos-assigned', { sosId: sos._id });

    res.json({ message: 'SOS assigned successfully', sos });
  } catch (err) {
    res.status(500).json({ message: 'Assignment failed' });
  }
});

// ─── POST /api/sos/:id/status — NGO updates status ───────
router.post('/:id/status', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    // Notify victim of status change
    req.io.to('victim').emit('sos-update', { 
      sosId: sos._id, 
      status 
    });

    res.json({ message: 'Status updated', sos });
  } catch (err) {
    res.status(500).json({ message: 'Status update failed' });
  }
});

module.exports = router;