// Test dashboard and streak data
const http = require('http');

function makeRequest(method, path, authToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('\n=== Testing Existing User Data ===\n');

  try {
    // Hardcoded test user that exists in your DB
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YzljYjI2MzJlMTc1ODhlODYwMWM2NiIsImlhdCI6MTcxMDc5NDc1NiwiZXhwIjoxNzExMzk5NTU2fQ.WRVVNnLKC9yY2F9L-z_Duk7Ygvp7TrIH6zPNOwAw9-o';
    
    // 1. Check user profile
    console.log('[1] Testing /auth/me...');
    const meRes = await makeRequest('GET', '/auth/me', token);
    console.log('User Info:');
    console.log('  ID:', meRes.id);
    console.log('  Email:', meRes.email);
    console.log('  TargetRole:', meRes.targetRole);
    console.log('  OnboardingCompleted:', meRes.onboardingCompleted);

    // 2. Check study stats (used by Dashboard)
    console.log('\n[2] Testing /study/stats...');
    const statsRes = await makeRequest('GET', '/study/stats', token);
    console.log('Study Stats:');
    console.log('  Total minutes:', statsRes.totalMinutes);
    console.log('  Streak:', statsRes.streak);
    console.log('  Daily Goal:', statsRes.dailyGoalMinutes, 'minutes');
    console.log('  Weekly Goal:', statsRes.weeklyGoalMinutes, 'minutes');
    console.log('  Goal Status:', statsRes.goalStatus?.status);
    console.log('  Today Minutes:', statsRes.todayMinutes);
    console.log('  This Week Minutes:', statsRes.thisWeekMinutes);
    console.log('Full Response:', JSON.stringify(statsRes, null, 2));

    // 3. Check skill gap
    console.log('\n[3] Testing /skills/analyze...');
    const analyzeRes = await makeRequest('GET', '/skills/analyze', token);
    console.log('Skill Gap Analysis:');
    console.log('  Role:', analyzeRes.role);
    console.log('  Match Score:', analyzeRes.overview?.match_score);
    console.log('  User Skills Count:', analyzeRes.userSkillsCount);

    console.log('\n=== Tests Complete ===\n');
    process.exit(0);

  } catch (err) {
    console.error('Test Error:', err.message);
    process.exit(1);
  }
}

setTimeout(runTests, 500);
