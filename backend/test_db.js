const mongoose = require('mongoose');
const DynamicRoadmap = require('./models/DynamicRoadmap');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/learnoptima');
    try {
        const doc = new DynamicRoadmap({
            role: 'Data Scientist',
            semesters: [{ sem: 1, title: 'Foundation', duration: "30 days", skills: ['Python'], tasks: ['Learn Python'] }]
        });
        await doc.save();
        console.log('Saved successfully!');
    } catch (err) {
        console.error('Error saving:', err.message);
    }
    process.exit(0);
}
run();
