import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import { awardPoints } from './challenges.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const photos = await ProgressPhoto.find({ userId: req.userId })
      .sort({ date: -1 });
    res.json(photos);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { image, label, date, notes } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image required' });
    }
    const photo = new ProgressPhoto({
      userId: req.userId,
      image,
      label: label || 'progress',
      date: date ? new Date(date) : new Date(),
      notes: notes || ''
    });
    await photo.save();
    await awardPoints(req.userId, 'add_progress_photo');
    res.status(201).json(photo);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const photo = await ProgressPhoto.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!photo) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
