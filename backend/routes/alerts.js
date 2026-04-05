const express = require('express');
const router  = express.Router();
const Alert   = require('../models/Alert');
const { authenticate, authorize } = require('../middleware/auth');

// GET all alerts — all roles
router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await Alert.find({ active: true }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// POST create alert — admin only
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { type, severity, region, message } = req.body;

    if (!region || !message) {
      return res.status(400).json({ message: 'Region and message are required' });
    }

    const alert = await Alert.create({
      type,
      severity,
      region,
      message,
      createdBy: req.user.id
    });

    // Broadcast to all connected clients instantly
    req.io.emit('new-alert', alert);

    res.status(201).json({ message: 'Alert broadcasted', alert });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create alert', error: err.message });
  }
});

// DELETE alert — admin only
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

module.exports = router;