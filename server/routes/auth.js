import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { verifyEmailWithAbstract } from '../services/abstractEmailValidation.js';
import { notifyAdmins } from '../realtime/adminHub.js';
import { authenticateToken } from '../middleware/auth.js';
import { isStrongPassword, PASSWORD_REQUIREMENTS } from '../utils/passwordPolicy.js';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie.js';

const router = express.Router();

// JWT lifetime: long when user chooses "keep me signed in", shorter otherwise
const tokenExpiry = (rememberMe) => (rememberMe ? '90d' : '7d');

// Basic email format check
const isValidEmailFormat = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const reservedAdminAccountEmail = () =>
  String(
    process.env.ADMIN_ACCOUNT_EMAIL || 'platform-admin@internal.gymbruski.app'
  )
    .trim()
    .toLowerCase();

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, rememberMe } = req.body;
    const stayLoggedIn = rememberMe !== false;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    if (!isValidEmailFormat(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (trimmedEmail === reservedAdminAccountEmail()) {
      return res.status(400).json({
        success: false,
        message: 'This email is reserved for the platform admin account.',
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS });
    }

    const emailCheck = await verifyEmailWithAbstract(trimmedEmail);
    if (!emailCheck.ok) {
      return res.status(400).json({
        success: false,
        message: emailCheck.message || 'Invalid or unreachable email address',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({ 
      email: trimmedEmail, 
      password: hashedPassword,
      name: String(name).trim() 
    });
    await user.save();

    if (!process.env.JWT_SECRET) {
      console.error('REGISTER: JWT_SECRET is not set (add it in Render → Environment)');
      return res.status(500).json({ success: false, message: 'Server error during registration' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry(stayLoggedIn) }
    );

    notifyAdmins({ reason: 'user.registered', email: user.email });

    setAuthCookie(res, token, stayLoggedIn);

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        name: user.name,
        role: user.role || 'user',
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
});

// LOGIN — email address OR username (e.g. platform admin "admin")
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const stayLoggedIn = rememberMe !== false;
    const identifier = String(email || '').trim().toLowerCase();

    if (!process.env.JWT_SECRET) {
      console.error('LOGIN: JWT_SECRET is not set (add it in Render → Environment)');
      return res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }

    let user = null;
    if (identifier.includes('@')) {
      user = await User.findOne({ email: identifier });
    } else if (identifier) {
      user = await User.findOne({ username: identifier });
    }
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    if (user.suspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.',
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry(stayLoggedIn) }
    );

    setAuthCookie(res, token, stayLoggedIn);

    res.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        name: user.name,
        role: user.role || 'user',
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
});

/** Lightweight ping: validates JWT + user still exists and not suspended. Used when Socket.io is unavailable. */
router.get('/session', authenticateToken, (req, res) => {
  res.json({ success: true });
});

/** Restore client user object when cookie is valid (e.g. new tab). */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        name: user.name,
        role: user.role || 'user',
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error('GET /auth/me:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

export default router;
