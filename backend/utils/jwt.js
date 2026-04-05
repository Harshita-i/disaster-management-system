const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET; // set in .env
const EXPIRY = '7d';

// Generate token — embeds userId and role
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    SECRET,
    { expiresIn: EXPIRY }
  );
}

// Verify and decode
function verifyToken(token) {
  return jwt.verify(token, SECRET); // throws if invalid/expired
}

module.exports = { generateToken, verifyToken };