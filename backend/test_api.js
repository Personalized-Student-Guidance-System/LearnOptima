// Quick test to check what API endpoints return
const http = require('http');

// Test data - create a unique test user each time
const testEmail = `test_${Date.now()}@test.com`;
const testPassword = 'TestPassword123';
const testName = 'Test User';

function makeRequest(method, path, body = null, authToken = null) {
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n=== API Testing ===\n');

  try {
    // 0. Register new user
    console.log('[0] Testing SIGNUP endpoint...');
    const signupRes = await makeRequest('POST', '/auth/signup', {
      name: testName,
      email: testEmail,
      password: testPassword,
      college: 'Test College',
      branch: 'CSE',
      semester: 1
    });
    console.log('Signup Response:', JSON.stringify(signupRes, null, 2));

    if (!signupRes.token) {
      console.log('\n❌ Signup failed. Cannot continue with other tests.');
      process.exit(0);
    }

    console.log('\n✅ Signup successful.');

    // 1. Login
    console.log('\n[1] Testing LOGIN endpoint...');
    const loginRes = await makeRequest('POST', '/auth/login', {
      email: testEmail,
      password: testPassword
    });
    console.log('Login Response:', JSON.stringify(loginRes, null, 2));

    if (!loginRes.token) {
      console.log('\n❌ Login failed. Cannot continue with other tests.');
      process.exit(0);
    }

    const token = loginRes.token;
    console.log('\n✅ Login successful. Token:', token.substring(0, 20) + '...');
    console.log('User TargetRole from login:', loginRes.user?.targetRole);

    // 2. Check /auth/me
    console.log('\n[2] Testing /auth/me endpoint...');
    const meRes = await makeRequest('GET', '/auth/me', null, token);
    console.log('Auth/me Response:');
    console.log('  - ID:', meRes.id);
    console.log('  - Email:', meRes.email);
    console.log('  - TargetRole:', meRes.targetRole);
    console.log('Full Response:', JSON.stringify(meRes, null, 2));

    // 3. Check /skills/analyze (should default to "Software Engineer" since no targetRole set)
    console.log('\n[3] Testing /skills/analyze endpoint (no targetRole set)...');
    const analyzeRes = await makeRequest('GET', '/skills/analyze', null, token);
    console.log('Skills/analyze Response:');
    console.log('  - Role:', analyzeRes.role);
    console.log('  - Match Score:', analyzeRes.overview?.match_score);
    console.log('  - User Skills Count:', analyzeRes.userSkillsCount);

    // 4. Check /skills/analyze with explicit query param
    console.log('\n[4] Testing /skills/analyze?role=DevOps Engineer...');
    const analyzeDevOpsRes = await makeRequest('GET', '/skills/analyze?role=DevOps Engineer', null, token);
    console.log('Skills/analyze (DevOps) Response:');
    console.log('  - Role:', analyzeDevOpsRes.role);
    console.log('  - Match Score:', analyzeDevOpsRes.overview?.match_score);

    console.log('\n=== Tests Complete ===\n');
    process.exit(0);

  } catch (err) {
    console.error('Test Error:', err.message);
    process.exit(1);
  }
}

// Wait a moment for server to be ready, then run tests
setTimeout(runTests, 1000);
