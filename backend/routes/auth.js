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

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();
    const normalizedRole = String(role || 'victim').trim().toLowerCase();

    // Block admin self-registration
    if (normalizedRole === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be self-registered' });
    }

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!['victim', 'ngo'].includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    if (normalizedRole === 'ngo' && !String(ngoName || '').trim()) {
      return res.status(400).json({ message: 'NGO name is required for NGO registration' });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password,
      role: normalizedRole,
      ngoName: normalizedRole === 'ngo' ? String(ngoName).trim() : undefined
    });

    res.status(201).json({
      token: generateToken(user),
      user: { id: user._id, name: user.name, role: user.role, approved: user.approved }
    });
  } catch (err) {
    console.error('Register error:', err.message);

    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
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
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// ─── GET CURRENT USER (protected) ────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

module.exports = router;