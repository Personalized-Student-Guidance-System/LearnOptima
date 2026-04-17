const mongoose = require('mongoose');
const DynamicRoadmap = require('./backend/models/DynamicRoadmap');
require('dotenv').config({ path: './backend/.env' });

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnoptima');
  
  const payload = {
    "role": "Quantum Cryptography Engineer",
    "phases": [
      {
        "title": "Beginner Phase",
        "duration": "4-8 weeks",
        "description": "Focusing on beginner skills",
        "tasks": ["Problem Solving", "Communication", "Research Skills"],
        "resources": [
          {
             "skill": "Problem Solving",
             "tier": "beginner",
             "resources": [{ "title": "A", "url": "B" }]
          }
        ]
      }
    ]
  };

  try {
      const generatedSemesters = payload.phases || payload.semesters;
      let dynamicRoadmap = new DynamicRoadmap({
         role: payload.role.trim(),
         semesters: generatedSemesters,
         source: 'ai_agent'
      });
      await dynamicRoadmap.save();
      console.log("Saved dynamically.");
      
      const obj = dynamicRoadmap.toObject();
      console.log(JSON.stringify(obj, null, 2));
      
      await DynamicRoadmap.deleteOne({ role: payload.role });
  } catch (err) {
      console.error("Error saving:", err);
  }
  
  process.exit(0);
}

test();
