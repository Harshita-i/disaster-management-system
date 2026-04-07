const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { authenticate, authorize } = require('../middleware/auth');

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
    const { type, region, message, severity } = req.body;
    if (!type || !region || !message) {
      return res.status(400).json({ message: 'type, region and message are required' });
    }

    const alert = await Alert.create({ type, region, message, severity });
    // Broadcast to all victims via socket
    req.io.to('victim').emit('new-alert', alert);

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