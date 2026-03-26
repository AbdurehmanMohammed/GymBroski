import express from 'express';
import mongoose from 'mongoose';
import { deleteUserAndAllRelatedData } from '../services/userCascadeDelete.js';

const router = express.Router();

/**
 * Admin-only: delete a user and all related data (same cascade as scripts/deleteUser.js).
 * Requires ADMIN_DELETE_SECRET in server env; send header: X-Admin-Secret: <value>
 *
 * DELETE /api/admin/users/:userId
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const expected = String(process.env.ADMIN_DELETE_SECRET || '').trim();
    if (!expected) {
      return res.status(503).json({
        success: false,
        message:
          'Admin deletion is not enabled. Set ADMIN_DELETE_SECRET in server environment, or use: npm run delete-user -- <userId>',
      });
    }
    const provided = String(req.headers['x-admin-secret'] || '').trim();
    if (provided !== expected) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const result = await deleteUserAndAllRelatedData(userId);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: result.message || 'User not found' });
    }

    res.json({ success: true, message: 'User and all related data removed.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
