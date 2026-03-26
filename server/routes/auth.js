import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { verifyEmailWithAbstract } from '../services/abstractEmailValidation.js';

const router = express.Router();

// JWT lifetime: long when user chooses "keep me signed in", shorter otherwise
const tokenExpiry = (rememberMe) => (rememberMe ? '90d' : '7d');

// Basic email format check
const isValidEmailFormat = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

// Strong password: 8+ chars, uppercase, lowercase, number, special char
const isStrongPassword = (str) => {
  if (!str || str.length < 8) return false;
  if (!/[A-Z]/.test(str)) return false;
  if (!/[a-z]/.test(str)) return false;
  if (!/[0-9]/.test(str)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(str)) return false;
  return true;
};

const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&*).';

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

    // Create token (new accounts: long session by default)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry(stayLoggedIn) }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
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

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const stayLoggedIn = rememberMe !== false;
    const trimmedEmail = String(email || '').trim().toLowerCase();

    if (!process.env.JWT_SECRET) {
      console.error('LOGIN: JWT_SECRET is not set (add it in Render → Environment)');
      return res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }

    // Find user (same normalization as register / User schema lowercase)
    const user = await User.findOne({ email: trimmedEmail });
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

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry(stayLoggedIn) }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
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

export default router;
