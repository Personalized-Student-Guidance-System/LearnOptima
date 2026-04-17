require('dotenv').config();
const mongoose = require('mongoose');
const DynamicRoadmap = require('./models/DynamicRoadmap');

async function run() {
    console.log('Connecting to', process.env.MONGO_URI.substring(0, 30) + '...');
    await mongoose.connect(process.env.MONGO_URI);
    try {
        console.log('Connected! Saving doc...');
        const r = new DynamicRoadmap({
            role: 'Test Role ' + Date.now(),
            semesters: [{ sem: 1, title: 'Test', duration: '30 days', skills: [], tasks: [] }]
        });
        await r.save();
        console.log('Saved! Fetching...');
        const doc = await DynamicRoadmap.findOne({ role: r.role });
        console.log('Found:', doc.role);
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
run();
