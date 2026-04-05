const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

// ─── REGISTER ───────────────────────────────────────────
// role comes from request body ('victim' | 'ngo' | 'admin')
// In production, block 'admin' here — create admin manually via DB
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, ngoName } = req.body;

    // Block admin self-registration
    if (role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be self-registered' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role, ngoName });

    res.status(201).json({
      token: generateToken(user),
      user: { id: user._id, name: user.name, role: user.role, approved: user.approved }
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await user.matchPassword(password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Block unapproved NGOs from logging in
    if (user.role === 'ngo' && !user.approved) {
      return res.status(403).json({ message: 'Your NGO account is pending admin approval' });
    }

    res.json({
      token: generateToken(user),
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// ─── GET CURRENT USER (protected) ────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

module.exports = router;