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

module.exports = router;