require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/planner', require('./routes/planner'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/burnout', require('./routes/burnout'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/career', require('./routes/career'));
app.use('/api/profile', require('./routes/profile'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));