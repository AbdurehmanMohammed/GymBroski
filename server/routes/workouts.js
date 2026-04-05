import express from 'express';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { authenticateToken } from '../middleware/auth.js';
import { awardPoints } from './challenges.js'; 

const router = express.Router();

const HAS_LETTER_RE = /[a-z]/i;
const HAS_DIGIT_RE = /\d/;
const REPS_FORMAT_RE = /^\d+(?:\s*-\s*\d+)?$/;
const WEIGHT_FORMAT_RE = /^\d+(?:\.\d+)?$/;

function hasWorkoutNameLetter(name) {
  return HAS_LETTER_RE.test(String(name || '').trim());
}

function hasNoDigits(text) {
  return !HAS_DIGIT_RE.test(String(text || '').trim());
}

function isRepsValid(reps) {
  return REPS_FORMAT_RE.test(String(reps ?? '').trim());
}

function isWeightValid(weight) {
  const t = String(weight ?? '').trim();
  if (/^bodyweight$/i.test(t)) return true;
  return WEIGHT_FORMAT_RE.test(t);
}

function mongooseValidationMessage(error) {
  if (error?.name !== 'ValidationError' || !error.errors) return '';
  return Object.values(error.errors)
    .map((e) => e.message)
    .join(' ');
}

function validateExercises(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return 'Add at least one exercise.';
  }
  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i] || {};
    const label = `Exercise ${i + 1}`;
    const exName = String(ex.name || '').trim();
    if (!exName) return `${label}: name is required.`;
    if (!hasNoDigits(exName)) return `${label}: name cannot include numbers.`;

    const setsNum = Number(ex.sets);
    if (!Number.isFinite(setsNum) || setsNum < 1) {
      return `${label}: sets must be a number greater than 0.`;
    }

    if (!isRepsValid(ex.reps)) {
      return `${label}: reps must be numbers only (example: 10 or 8-12).`;
    }

    if (!isWeightValid(ex.weight)) {
      return `${label}: weight must be numeric only (example: 20 or 20.5).`;
    }
  }
  return '';
}

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
    if (!hasWorkoutNameLetter(name)) {
      return res.status(400).json({
        success: false,
        message: 'Workout name cannot be only numbers. Add at least one letter.'
      });
    }
    if (!hasNoDigits(name)) {
      return res.status(400).json({
        success: false,
        message: 'Workout name cannot include numbers.'
      });
    }
    const exerciseError = validateExercises(exercises);
    if (exerciseError) {
      return res.status(400).json({
        success: false,
        message: exerciseError
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
    const vmsg = mongooseValidationMessage(error);
    if (vmsg) {
      return res.status(400).json({ success: false, message: vmsg });
    }
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
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: 'Workout name is required'
      });
    }
    if (!hasWorkoutNameLetter(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: 'Workout name cannot be only numbers. Add at least one letter.'
      });
    }
    if (!hasNoDigits(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: 'Workout name cannot include numbers.'
      });
    }
    const exerciseError = validateExercises(exercises);
    if (exerciseError) {
      return res.status(400).json({
        success: false,
        message: exerciseError
      });
    }
    
    const workout = await WorkoutSplit.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.userId 
      },
      {
        name: trimmedName,
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
    const vmsg = mongooseValidationMessage(error);
    if (vmsg) {
      return res.status(400).json({ success: false, message: vmsg });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating workout',
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
