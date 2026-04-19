const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SOS = require('../models/SOS');
const { authenticate, authorize } = require('../middleware/auth');

/** NGO / admin: approved responder bases with coordinates (for map). */
router.get('/ngo-bases', authenticate, authorize('ngo', 'admin'), async (req, res) => {
  try {
    const list = await User.find({
      role: 'ngo',
      approved: true,
      blocked: { $ne: true },
      'location.lat': { $exists: true, $ne: null },
      'location.lng': { $exists: true, $ne: null }
    })
      .select('name ngoName location')
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load NGO bases' });
  }
});

/** Victim / NGO: update own last-known location (e.g. responder base on map). */
router.patch('/me/location', authenticate, authorize('victim', 'ngo'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { location: { lat: latNum, lng: lngNum, updatedAt: new Date() } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// GET all users
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

// Approve NGO
router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { approved: true },
    { new: true }
  ).select('-password');
  res.json({ message: 'NGO approved', user });
});

// Block user
router.patch('/:id/block', authenticate, authorize('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { blocked: true },
    { new: true }
  ).select('-password');
  res.json({ message: 'User blocked', user });
});

// Delete user
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ message: 'Cannot delete yourself' });
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Delete user's SOS requests
  await SOS.deleteMany({ userId: req.params.id });
  
  // Emit to all dashboards to refetch SOS list
  req.io.to('ngo').emit('sos-list-updated');
  req.io.to('admin').emit('sos-list-updated');

  res.json({ message: 'User deleted' });
});

module.exports = router;