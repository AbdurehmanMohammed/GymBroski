import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
      }

      try {
        const account = await User.findById(decoded.userId).select('suspended');
        if (!account) {
          return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        if (account.suspended) {
          return res.status(403).json({
            success: false,
            message: 'Your account has been suspended. Contact support.',
          });
        }
      } catch (e) {
        console.error('authenticateToken suspended check:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
      }

      req.userId = decoded.userId;
      req.userRole = decoded.role || 'user';
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/** After authenticateToken — checks DB so role changes apply without trusting JWT alone. */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const user = await User.findById(req.userId).select('role suspended');
    if (!user || user.role !== 'admin' || user.suspended) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch (e) {
    console.error('requireAdmin:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
