import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import BodyWeight from '../models/BodyWeight.js';
import WaterIntake from '../models/WaterIntake.js';
import PersonalRecord from '../models/PersonalRecord.js';
import { awardPoints } from './challenges.js';

const router = express.Router();
router.use(authenticateToken);

const today = () => new Date(new Date().setHours(0, 0, 0, 0));

// --- Body Weight ---
router.get('/body-weight', async (req, res) => {
  try {
    const entries = await BodyWeight.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(100);
    res.json(entries);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/body-weight', async (req, res) => {
  try {
    const { weight, date, notes } = req.body;
    if (!weight || weight <= 0) {
      return res.status(400).json({ success: false, message: 'Valid weight required' });
    }
    const entry = new BodyWeight({
      userId: req.userId,
      weight: Number(weight),
      date: date ? new Date(date) : new Date(),
      notes: notes || ''
    });
    await entry.save();
    await awardPoints(req.userId, 'log_body_weight');
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/body-weight/:id', async (req, res) => {
  try {
    const entry = await BodyWeight.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Water Intake ---
router.get('/water', async (req, res) => {
  try {
    const entries = await WaterIntake.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(60);
    res.json(entries);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/water/:id', async (req, res) => {
  try {
    const entry = await WaterIntake.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/water/today', async (req, res) => {
  try {
    const start = today();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const entries = await WaterIntake.find({
      userId: req.userId,
      date: { $gte: start, $lt: end }
    });
    const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
    res.json({ total, entries });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/water', async (req, res) => {
  try {
    const { amount, unit, date } = req.body;
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
    const entry = new WaterIntake({
      userId: req.userId,
      amount: amt,
      unit: unit || 'ml',
      date: date ? new Date(date) : new Date()
    });
    await entry.save();
    await awardPoints(req.userId, 'log_water');
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Personal Records ---
router.get('/pr', async (req, res) => {
  try {
    const records = await PersonalRecord.find({ userId: req.userId })
      .sort({ date: -1 });
    res.json(records);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get another user's PRs (for viewing their profile)
router.get('/pr/user/:userId', async (req, res) => {
  try {
    const records = await PersonalRecord.find({ userId: req.params.userId })
      .sort({ date: -1 })
      .limit(50);
    res.json(records);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/pr', async (req, res) => {
  try {
    const { exerciseName, weight, reps, unit, date, notes } = req.body;
    if (!exerciseName || !weight || weight <= 0) {
      return res.status(400).json({ success: false, message: 'Exercise name and valid weight required' });
    }
    const record = new PersonalRecord({
      userId: req.userId,
      exerciseName: exerciseName.trim(),
      weight: Number(weight),
      reps: Number(reps) || 1,
      unit: unit || 'kg',
      date: date ? new Date(date) : new Date(),
      notes: notes || ''
    });
    await record.save();
    await awardPoints(req.userId, 'add_pr');
    const prCount = await PersonalRecord.countDocuments({ userId: req.userId });
    if (prCount === 1) await awardPoints(req.userId, 'first_pr');
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/pr/:id', async (req, res) => {
  try {
    const record = await PersonalRecord.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
