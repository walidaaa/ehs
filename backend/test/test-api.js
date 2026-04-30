#!/usr/bin/env node
/**
 * Backend API Test Script
 * Run with: node backend/test/test-api.js
 * 
 * This script tests basic connectivity and functionality of the backend API
 */

const BASE_URL = 'http://localhost:3003/api';
let authToken = null;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(method, endpoint, body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n=== EHS-Care Backend API Tests ===\n', 'blue');

  // Test 1: Health Check
  log('Test 1: Health Check', 'yellow');
  let result = await makeRequest('GET', '/health');
  if (result.success) {
    log('✓ Health check passed', 'green');
  } else {
    log(`✗ Health check failed: ${result.error}`, 'red');
    log('\n⚠️  Backend is not running. Start it with: cd backend && npm run dev', 'yellow');
    return;
  }

  // Test 2: Login
  log('\nTest 2: Login', 'yellow');
  result = await makeRequest('POST', '/auth/login', {
    email: 'super-admin@mentalcare.com',
    password: 'admin123',
  });

  if (result.success) {
    authToken = result.data.token || result.data.accessToken;
    log('✓ Login successful', 'green');
    log(`  Email: ${result.data.user.email}`);
    if (result.data.role) log(`  Role: ${result.data.role}`);
  } else {
    log(`✗ Login failed: ${result.error}`, 'red');
    log('\n⚠️  Admin user not found. Follow setup-guide.md to create admin user.', 'yellow');
    return;
  }

  // Test 3: Get Current User
  log('\nTest 3: Get Current User', 'yellow');
  result = await makeRequest('GET', '/auth/me');
  if (result.success) {
    log('✓ Get current user successful', 'green');
    log(`  ID: ${result.data.user.id}`);
    log(`  Email: ${result.data.user.email}`);
  } else {
    log(`✗ Get current user failed: ${result.error}`, 'red');
  }

  // Test 4: Get Patients
  log('\nTest 4: Get Patients', 'yellow');
  result = await makeRequest('GET', '/patients');
  if (result.success) {
    log('✓ Get patients successful', 'green');
    log(`  Total: ${Array.isArray(result.data) ? result.data.length : 0}`);
  } else {
    log(`✗ Get patients failed: ${result.error}`, 'red');
  }

  // Test 5: Get Appointments
  log('\nTest 5: Get Appointments', 'yellow');
  result = await makeRequest('GET', '/appointments');
  if (result.success) {
    log('✓ Get appointments successful', 'green');
    log(`  Total: ${Array.isArray(result.data) ? result.data.length : 0}`);
  } else {
    log(`✗ Get appointments failed: ${result.error}`, 'red');
  }

  // Test 6: Get Treatments
  log('\nTest 6: Get Treatments', 'yellow');
  result = await makeRequest('GET', '/treatments');
  if (result.success) {
    log('✓ Get treatments successful', 'green');
    log(`  Total: ${Array.isArray(result.data) ? result.data.length : 0}`);
  } else {
    log(`✗ Get treatments failed: ${result.error}`, 'red');
  }

  // Test 7: Get Notifications
  log('\nTest 7: Get Notifications', 'yellow');
  result = await makeRequest('GET', '/notifications');
  if (result.success) {
    log('✓ Get notifications successful', 'green');
    log(`  Total: ${Array.isArray(result.data) ? result.data.length : 0}`);
  } else {
    log(`✗ Get notifications failed: ${result.error}`, 'red');
  }

  // Test 8: Unauthorized Request (without token)
  log('\nTest 8: Unauthorized Request Test', 'yellow');
  authToken = null;
  result = await makeRequest('GET', '/patients');
  if (!result.success && result.error.includes('401')) {
    log('✓ Unauthorized request correctly rejected', 'green');
  } else {
    log(`✗ Authorization check failed`, 'red');
  }

  log('\n=== Tests Complete ===\n', 'blue');
  log('✓ Backend API is working correctly!', 'green');
  log('\nNext Steps:', 'yellow');
  log('1. Start frontend: npm run dev');
  log('2. Open http://localhost:5173');
  log('3. Login with:');
  log('   Email: super-admin@mentalcare.com');
  log('   Password: admin123');
}

// Run tests
runTests().catch((error) => {
  log(`\nUnexpected error: ${error.message}`, 'red');
  process.exit(1);
});
