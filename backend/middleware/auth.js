const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  console.log('[AUTH] Request:', req.path, 'Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'MISSING');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    console.log('[AUTH ERROR] No token - 401');
    return res.status(401).json({ message: 'No token, access denied' });
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[AUTH OK] User ID:', user.id);
    req.user = user;
    next();
  } catch (err) {
    console.error('[AUTH ERROR] Invalid token:', err.message, 'Token preview:', token.substring(0, 20) + '...');
    res.status(401).json({ message: 'Invalid token', error: err.message });
  }
};
