const { verifyToken } = require('../utils/jwt');

// 1. Authenticate — confirms valid JWT
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, role } now available in all routes
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// 2. Authorize — restricts by role(s)
// Usage: authorize('admin') or authorize('ngo', 'admin')
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };