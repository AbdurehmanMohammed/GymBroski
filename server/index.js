import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes
import authRoutes from './routes/auth.js';
import workoutRoutes from './routes/workouts.js';
import profileRoutes from './routes/profile.js';
import trackingRoutes from './routes/tracking.js';
import progressPhotosRoutes from './routes/progressPhotos.js';
import communityPhotosRoutes from './routes/communityPhotos.js';
import challengesRoutes from './routes/challenges.js';
import workoutSessionsRoutes from './routes/workoutSessions.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';

// Import models
import User from './models/User.js';
import './models/WorkoutSplit.js';
import './models/BodyWeight.js';
import './models/WaterIntake.js';
import './models/PersonalRecord.js';
import './models/ProgressPhoto.js';
import './models/WorkoutSession.js';
import { normalizeAbstractEmailApiKey } from './services/abstractEmailValidation.js';
import cron from 'node-cron';
import { runWorkoutReminderJob } from './jobs/workoutReminders.js';
import { ensurePlatformAdminFromEnv } from './services/platformAdminBootstrap.js';
import { attachAdminSocket } from './realtime/adminSocket.js';

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
/* Base64 workout/community images need headroom (10mb was too small for many phone photos). */
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/progress-photos', progressPhotosRoutes);
app.use('/api/community-photos', communityPhotosRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/workout-sessions', workoutSessionsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Gym App API is running');
});

// MongoDB connection
async function ensureAdminEmailFromEnv() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.log('[admin] ADMIN_EMAIL not set in .env — add it to promote an account, then restart.');
    return;
  }
  const r = await User.updateOne({ email }, { $set: { role: 'admin' } });
  if (r.matchedCount === 0) {
    console.warn(
      `[admin] ADMIN_EMAIL=${email} — no user with that email. Register that account first, then restart the server.`
    );
  } else {
    console.log(`[admin] role=admin ensured for ${email}`);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    attachAdminSocket(httpServer);
    console.log('Socket.io: /socket.io (JWT — user rooms + admin dashboard)');
    await ensurePlatformAdminFromEnv();
    await ensureAdminEmailFromEnv();
    if (process.env.WORKOUT_REMINDER_CRON === 'false') {
      console.log('Workout reminder cron: off');
      return;
    }
    cron.schedule('*/10 * * * *', async () => {
      try {
        const r = await runWorkoutReminderJob();
        if (r.sent > 0) console.log('[workoutReminders] sent', r.sent, 'email(s)');
      } catch (e) {
        console.error('[workoutReminders]', e);
      }
    });
    console.log('Workout reminder cron: every 10 min (WORKOUT_REMINDER_CRON=false to disable)');
    console.log(
      '[workoutReminders] env flags:',
      `TRUST_SAVED_TIME=${process.env.WORKOUT_REMINDER_TRUST_SAVED_TIME === 'true'}`,
      `DEBUG=${process.env.WORKOUT_REMINDER_DEBUG === 'true'}`
    );
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Error handling
app.use((error, req, res, next) => {
  if (error?.status === 413 || error?.type === 'entity.too.large' || error?.name === 'PayloadTooLargeError') {
    return res.status(413).json({
      success: false,
      message: 'Photo is too large. Try a smaller image or lower camera resolution.',
    });
  }
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: error.message,
  });
});

const PORT = process.env.PORT || 5000;

function logAbstractEmailStatus() {
  const key = normalizeAbstractEmailApiKey(process.env.ABSTRACT_EMAIL_API_KEY || '');
  if (key.length > 0) {
    const product = String(process.env.ABSTRACT_EMAIL_PRODUCT || 'reputation').toLowerCase().trim();
    const host =
      product === 'validation' ? 'emailvalidation.abstractapi.com' : 'emailreputation.abstractapi.com';
    console.log(`Abstract Email (${product}): key loaded ✓ (register uses ${host})`);
    console.log(
      `  → Key length ${key.length}. Use the Primary Key from that Abstract product’s page. For Email Validation instead, set ABSTRACT_EMAIL_PRODUCT=validation in .env.`
    );
    if (process.env.ABSTRACT_EMAIL_SKIP_VERIFICATION === 'true') {
      console.log('  → ABSTRACT_EMAIL_SKIP_VERIFICATION=true — API is not called on sign-up.');
    }
  } else {
    console.log(
      'Abstract Email Validation: off (add ABSTRACT_EMAIL_API_KEY to .env to verify emails on sign-up)'
    );
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  logAbstractEmailStatus();
});
