const axios = require('axios');

async function run() {
    try {
        console.log('Logging in...');
        const res1 = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'sesh@gmail.com',
            password: 'hello123'
        });
        const token = res1.data.token;
        console.log('Token acquired:', token.slice(0, 10) + '...');

        console.log('Getting Profile...');
        const res2 = await axios.get('http://localhost:5000/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Target Roles:', res2.data.targetRoles);

        console.log('Fetching Roadmap for Data Scientist...');
        const res3 = await axios.get('http://localhost:5000/api/career/personalized?role=Data Scientist', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Roadmap response keys:', Object.keys(res3.data));
        console.log('Roadmap structure:', Object.keys(res3.data.roadmap || {}));
        
        console.log('Testing Reschedule Planner endpoint...');
        const res4 = await axios.post('http://localhost:5000/api/planner/sync-roadmap', { role: 'Data Scientist' }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Planner synced tasks count:', res4.data.length);

    } catch (err) {
        if (err.response) {
            console.error('Error:', err.response.status, err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}
run();
