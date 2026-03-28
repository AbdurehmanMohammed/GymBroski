import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookie.js';

function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }
  return null;
}

/** Prefer httpOnly cookie; still accept Authorization: Bearer for tools/scripts. */
export function getJwtFromRequest(req) {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME];
  if (fromCookie) return String(fromCookie);
  return getBearerToken(req);
}

export const authenticateToken = (req, res, next) => {
  try {
    const token = getJwtFromRequest(req);

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
