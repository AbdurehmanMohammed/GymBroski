/**
 * Delete a user and all related data (same cascade as DELETE /api/admin/users/:id with X-Admin-Secret).
 * Usage (from server/): node scripts/deleteUser.js <mongoObjectId>
 *    or: node scripts/deleteUser.js email:user@example.com
 *
 * Requires MONGO_URI in .env (same folder as index.js).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { deleteUserAndAllRelatedData } from '../services/userCascadeDelete.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/deleteUser.js <userId> | email:you@example.com');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  let userId = arg;
  if (arg.startsWith('email:')) {
    const email = arg.slice(6).trim().toLowerCase();
    const u = await User.findOne({ email }).select('_id email');
    if (!u) {
      console.error('No user with that email');
      process.exit(1);
    }
    userId = u._id.toString();
    console.log('Found user', u.email, u._id.toString());
  }
  const r = await deleteUserAndAllRelatedData(userId);
  console.log(r.ok ? 'Deleted user and related data.' : r.message);
  await mongoose.disconnect();
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
