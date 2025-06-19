import axios from 'axios';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = process.env.API_BASE_URL || 'https://camerachatbackend-production.up.railway.app';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { username: 'testuser1', password: 'password123' },
  { username: 'testuser2', password: 'password456' }
];

let userTokens = [];
let chatRequestId = null;

// Utility functions
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testHealthCheck() {
  log('Testing health check...');
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    log('✅ Health check passed', response.data);
    return true;
  } catch (error) {
    log('❌ Health check failed', error.message);
    return false;
  }
}

async function testUserRegistration() {
  log('Testing user registration...');
  const results = [];
  
  for (const user of testUsers) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, user);
      userTokens.push({ username: user.username, token: response.data.token });
      log(`✅ User ${user.username} registered successfully`);
      results.push(true);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        log(`⚠️ User ${user.username} already exists, trying login...`);
        const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, user);
        userTokens.push({ username: user.username, token: loginResponse.data.token });
        log(`✅ User ${user.username} logged in successfully`);
        results.push(true);
      } else {
        log(`❌ Failed to register user ${user.username}`, error.response?.data?.error || error.message);
        results.push(false);
      }
    }
  }
  
  return results.every(result => result);
}

async function testChatRequest() {
  log('Testing chat request...');
  try {
    const senderToken = userTokens[0].token;
    const receiverUsername = userTokens[1].username;
    
    const response = await axios.post(`${API_BASE_URL}/api/chat/request`, {
      receiverUsername
    }, {
      headers: {
        'Authorization': `Bearer ${senderToken}`
      }
    });
    
    chatRequestId = response.data.requestId;
    log('✅ Chat request sent successfully', response.data);
    return true;
  } catch (error) {
    log('❌ Chat request failed', error.response?.data?.error || error.message);
    return false;
  }
}

async function testGetChatRequests() {
  log('Testing get chat requests...');
  try {
    const receiverToken = userTokens[1].token;
    
    const response = await axios.get(`${API_BASE_URL}/api/chat/requests`, {
      headers: {
        'Authorization': `Bearer ${receiverToken}`
      }
    });
    
    log('✅ Chat requests retrieved successfully', response.data);
    return response.data.length > 0;
  } catch (error) {
    log('❌ Get chat requests failed', error.response?.data?.error || error.message);
    return false;
  }
}

async function testRespondToChatRequest() {
  log('Testing respond to chat request...');
  try {
    const receiverToken = userTokens[1].token;
    
    const response = await axios.post(`${API_BASE_URL}/api/chat/respond`, {
      requestId: chatRequestId,
      accepted: true
    }, {
      headers: {
        'Authorization': `Bearer ${receiverToken}`
      }
    });
    
    log('✅ Chat request accepted successfully', response.data);
    return true;
  } catch (error) {
    log('❌ Respond to chat request failed', error.response?.data?.error || error.message);
    return false;
  }
}

async function testWebSocketConnection() {
  log('Testing WebSocket connection...');
  return new Promise((resolve) => {
    try {
      const token = userTokens[0].token;
      const ws = new WebSocket(`${API_BASE_URL.replace('https', 'wss')}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      ws.on('open', () => {
        log('✅ WebSocket connection established');
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (error) => {
        log('❌ WebSocket connection failed', error.message);
        resolve(false);
      });
      
      setTimeout(() => {
        log('❌ WebSocket connection timeout');
        resolve(false);
      }, 5000);
    } catch (error) {
      log('❌ WebSocket connection error', error.message);
      resolve(false);
    }
  });
}

async function testStreamFrame() {
  log('Testing stream frame...');
  try {
    const token = userTokens[0].token;
    const userId = 'test-user-id';
    
    // Create a simple test image (1x1 pixel JPEG)
    const testImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
      0x07, 0xFF, 0xD9
    ]);
    
    const response = await axios.post(`${API_BASE_URL}/api/stream/${userId}`, testImageBuffer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/jpeg'
      }
    });
    
    log('✅ Stream frame sent successfully', response.data);
    return true;
  } catch (error) {
    log('❌ Stream frame failed', error.response?.data?.error || error.message);
    return false;
  }
}

async function testMCPServerEndpoints() {
  log('Testing MCP Server endpoints...');
  const results = [];
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${MCP_SERVER_URL}/health`);
    log('✅ MCP Server health check passed', healthResponse.data);
    results.push(true);
  } catch (error) {
    log('❌ MCP Server health check failed', error.message);
    results.push(false);
  }
  
  try {
    // Test test-users endpoint
    const usersResponse = await axios.get(`${MCP_SERVER_URL}/test-users`);
    log('✅ MCP Server test-users endpoint passed', usersResponse.data);
    results.push(true);
  } catch (error) {
    log('❌ MCP Server test-users endpoint failed', error.message);
    results.push(false);
  }
  
  return results.every(result => result);
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting ESPStreamCloud API tests...');
  log(`API Base URL: ${API_BASE_URL}`);
  log(`MCP Server URL: ${MCP_SERVER_URL}`);
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'Chat Request', fn: testChatRequest },
    { name: 'Get Chat Requests', fn: testGetChatRequests },
    { name: 'Respond to Chat Request', fn: testRespondToChatRequest },
    { name: 'WebSocket Connection', fn: testWebSocketConnection },
    { name: 'Stream Frame', fn: testStreamFrame },
    { name: 'MCP Server Endpoints', fn: testMCPServerEndpoints }
  ];
  
  const results = [];
  
  for (const test of tests) {
    log(`\n📋 Running test: ${test.name}`);
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
      await delay(1000); // Wait between tests
    } catch (error) {
      log(`❌ Test ${test.name} threw an error:`, error.message);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  // Summary
  log('\n📊 Test Results Summary:');
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    log(`${status} ${result.name}${result.error ? ` - ${result.error}` : ''}`);
  });
  
  log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    log('🎉 All tests passed! The API is working correctly.');
  } else {
    log('⚠️ Some tests failed. Please check the logs above for details.');
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests }; 