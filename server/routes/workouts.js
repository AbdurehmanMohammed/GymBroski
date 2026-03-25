import express from 'express';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { authenticateToken } from '../middleware/auth.js';
import { awardPoints } from './challenges.js'; 

const router = express.Router();

// Protect all routes
router.use(authenticateToken);

// 1. GET all my workouts
router.get('/', async (req, res) => {
  try {
    const workouts = await WorkoutSplit.find({ userId: req.userId })
      .sort({ updatedAt: -1 });
    
    // FIXED: Return just the array
    res.json(workouts);
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching workouts' 
    });
  }
});

// 2. GET community/all workouts (for frontend compatibility)
router.get('/community/all', async (req, res) => {
  try {
    const publicWorkouts = await WorkoutSplit.find({ isPublic: true })
      .populate('userId', 'name email profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // FIXED: Return just the array
    res.json(publicWorkouts);
  } catch (error) {
    console.error('Get community workouts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching community workouts' 
    });
  }
});

// 3. GET public workouts (alias)
router.get('/public', async (req, res) => {
  try {
    const publicWorkouts = await WorkoutSplit.find({ isPublic: true })
      .populate('userId', 'name email profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // FIXED: Return just the array
    res.json(publicWorkouts);
  } catch (error) {
    console.error('Get public workouts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching public workouts' 
    });
  }
});

// 3b. GET public workouts by a specific user (for viewing their profile)
router.get('/community/by-user/:userId', async (req, res) => {
  try {
    const publicWorkouts = await WorkoutSplit.find({
      isPublic: true,
      userId: req.params.userId
    })
      .populate('userId', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(publicWorkouts);
  } catch (error) {
    console.error('Get community workouts by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user workouts'
    });
  }
});

// 4. GET single workout by ID
router.get('/:id', async (req, res) => {
  try {
    const workout = await WorkoutSplit.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    // FIXED: Return just the workout object
    res.json(workout);
  } catch (error) {
    console.error('Get single workout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching workout' 
    });
  }
});

// 5. CREATE new workout
router.post('/', async (req, res) => {
  try {
    const { name, description, isPublic, exercises, copiedFrom } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workout name is required'
      });
    }
    
    const workout = new WorkoutSplit({
      userId: req.userId,
      name: name.trim(),
      description: description?.trim() || '',
      isPublic: isPublic !== undefined ? isPublic : true,
      copiedFrom: copiedFrom?.trim() || null,
      exercises: exercises || []
    });
    
    await workout.save();
    await awardPoints(req.userId, workout.isPublic ? 'create_public_workout' : 'create_private_workout');
    
    // FIXED: Return just the workout object
    res.status(201).json(workout);
    
  } catch (error) {
    console.error('Create workout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating workout'
    });
  }
});

// 6. UPDATE workout by ID
router.put('/:id', async (req, res) => {
  try {
    const { name, description, isPublic, exercises } = req.body;
    
    const workout = await WorkoutSplit.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.userId 
      },
      {
        name: name?.trim(),
        description: description?.trim(),
        isPublic,
        exercises
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    // FIXED: Return just the workout object
    res.json(workout);
    
  } catch (error) {
    console.error('Update workout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error updating workout' 
    });
  }
});

// 7. DELETE workout by ID
router.delete('/:id', async (req, res) => {
  try {
    const workout = await WorkoutSplit.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Workout deleted successfully!' 
    });
    
  } catch (error) {
    console.error('Delete workout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting workout' 
    });
  }
});

export default router;
