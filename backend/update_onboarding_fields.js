// update_onboarding_fields.js
// Run this script with: node update_onboarding_fields.js

const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/learnoptima';

async function updateUsers() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const result = await User.updateMany(
    { $or: [ { onboardingStep: { $exists: false } }, { onboardingCompleted: { $exists: false } } ] },
    { $set: { onboardingStep: 1, onboardingCompleted: false } }
  );
  console.log(`Updated ${result.nModified || result.modifiedCount} users.`);
  await mongoose.disconnect();
}

updateUsers().catch(err => { console.error(err); process.exit(1); });
