// Auth middleware verifies JWT bearer tokens and hydrates req.user for downstream access checks.
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    // Normalise legacy roles so downstream code sees only supported values.
    // Supported roles: dean, admin, coordinator, student
    if (req.user.role === 'superadmin') {
      req.user.role = 'dean';
    } else if (req.user.role === 'attender') {
      req.user.role = 'student';
    }
    // admin role is already valid, no normalization needed
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export default authMiddleware;
