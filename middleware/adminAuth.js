require('dotenv').config();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';

function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid admin token' });
  }
  next();
}

module.exports = adminAuth;
