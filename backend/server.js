require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const mlUrl = process.env.ML_SERVICE_URL;
console.log('[Config] Cloudinary:', hasCloudinary ? 'configured' : 'not set');
console.log('[Config] ML_SERVICE_URL:', mlUrl || 'not set (Node parser will be used for resume/syllabus)');

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/authRoutes', require('./routes/authRoutes'));
app.use('/api/planner', require('./routes/planner'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/burnout', require('./routes/burnout'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/career', require('./routes/career'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/ml', require('./routes/mlRoutes'));
app.use('/api/onboarding', require('./routes/onboardingRoutes'));
app.use('/api/study', require('./routes/study'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

