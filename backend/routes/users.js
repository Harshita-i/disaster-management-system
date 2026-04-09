const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

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