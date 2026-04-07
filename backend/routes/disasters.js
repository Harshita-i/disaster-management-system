const express = require('express');
const router = express.Router();
const Disaster = require('../models/Disaster');
const { authenticate, authorize } = require('../middleware/auth');

// Get all disasters (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const disasters = await Disaster.find().populate('reportedBy assignedNGO', 'name email');
    res.json(disasters);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch disasters' });
  }
});

// Get disasters for current user (victim: their reports; ngo: assigned or all pending)
router.get('/my', authenticate, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'victim') {
      query.reportedBy = req.user.id;
    } else if (req.user.role === 'ngo') {
      query = { $or: [{ status: 'pending' }, { assignedNGO: req.user.id }] };
    }
    const disasters = await Disaster.find(query).populate('reportedBy assignedNGO', 'name email');
    res.json(disasters);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch disasters' });
  }
});

// Report a disaster (victims only)
router.post('/', authenticate, authorize('victim'), async (req, res) => {
  try {
    const { description, location } = req.body;
    const disaster = await Disaster.create({
      description,
      location,
      reportedBy: req.user.id
    });
    // Emit socket event
    req.io.to('ngo').emit('disaster-reported', { disaster });
    res.status(201).json(disaster);
  } catch (err) {
    res.status(500).json({ message: 'Failed to report disaster' });
  }
});

// Update disaster (NGOs: respond; Admins: any update)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status, assignedNGO } = req.body;
    const disaster = await Disaster.findById(req.params.id);
    if (!disaster) return res.status(404).json({ message: 'Disaster not found' });

    if (req.user.role === 'ngo' && disaster.status === 'pending') {
      disaster.status = 'responding';
      disaster.assignedNGO = req.user.id;
      // Emit to victim
      req.io.to('victim').emit('help-arrived', { victimId: disaster.reportedBy, message: 'NGO is responding' });
    } else if (req.user.role === 'admin') {
      if (status) disaster.status = status;
      if (assignedNGO) disaster.assignedNGO = assignedNGO;
    } else {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await disaster.save();
    res.json(disaster);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update disaster' });
  }
});

module.exports = router;