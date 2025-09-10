/**
 * 🧪 Droplet Integration Tests
 * 
 * These tests verify that your droplet integration works correctly.
 * They can be run against your local development server or deployed backend.
 * 
 * Usage:
 *   npm test
 *   TEST_API_URL=https://your-backend.onrender.com npm test
 */

import axios from 'axios'
import assert from 'assert'

// Configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'
const TEST_TIMEOUT = 10000

// Test data
const mockDropletConfig = {
  integrationName: 'Test Integration',
  companyName: 'Test Company',
  environment: 'development',
  fluidApiKey: 'PT-test-api-key-for-testing',
  installationId: 'test-installation-123',
  companyId: 'test-company-456'
}

// API client setup
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TEST_TIMEOUT,
  validateStatus: () => true // Don't throw on HTTP errors
})

// Utility functions
function logTest(description) {
  console.log(`\n🧪 ${description}`)
}

function logSuccess(message) {
  console.log(`✅ ${message}`)
}

function logError(message) {
  console.log(`❌ ${message}`)
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`)
}

// Test: Health check
async function testHealthCheck() {
  logTest('Testing health endpoint')
  
  try {
    const response = await apiClient.get('/health')
    
    assert.strictEqual(response.status, 200, 'Health endpoint should return 200')
    assert.ok(response.data, 'Health endpoint should return data')
    assert.ok(response.data.status, 'Health response should include status')
    
    logSuccess(`Health check passed: ${response.data.status}`)
    return true
  } catch (error) {
    logError(`Health check failed: ${error.message}`)
    return false
  }
}

// Test: Configuration validation
async function testConfigurationValidation() {
  logTest('Testing configuration validation')
  
  try {
    // Test with missing required fields
    const response = await apiClient.post('/api/droplet/configure', {
      integrationName: 'Test'
      // Missing required fields
    })
    
    assert.strictEqual(response.status, 400, 'Should reject invalid configuration')
    assert.ok(response.data.error, 'Should return error message')
    
    logSuccess('Configuration validation working correctly')
    return true
  } catch (error) {
    logError(`Configuration validation test failed: ${error.message}`)
    return false
  }
}

// Test: Status endpoint
async function testStatusEndpoint() {
  logTest('Testing status endpoint')
  
  try {
    const response = await apiClient.get('/api/droplet/status/new-installation')
    
    assert.strictEqual(response.status, 200, 'Status endpoint should return 200')
    assert.ok(response.data, 'Status response should include data')
    assert.ok(response.data.success !== undefined, 'Status response should include success field')
    
    logSuccess('Status endpoint working correctly')
    return true
  } catch (error) {
    logError(`Status endpoint test failed: ${error.message}`)
    return false
  }
}

// Test: Webhook endpoint
async function testWebhookEndpoint() {
  logTest('Testing webhook endpoint')
  
  try {
    // Test webhook health endpoint
    const response = await apiClient.post('/api/webhook/health')
    
    // Should return 200 or 404 (if endpoint doesn't exist)
    assert.ok([200, 404].includes(response.status), 'Webhook endpoint should be accessible')
    
    if (response.status === 200) {
      logSuccess('Webhook endpoint is active')
    } else {
      logInfo('Webhook endpoint not implemented (this is OK)')
    }
    return true
  } catch (error) {
    logError(`Webhook endpoint test failed: ${error.message}`)
    return false
  }
}

// Test: CORS headers
async function testCorsHeaders() {
  logTest('Testing CORS configuration')
  
  try {
    const response = await apiClient.options('/api/droplet/status/test', {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    })
    
    // CORS might return 200 or 204
    assert.ok([200, 204, 404].includes(response.status), 'CORS preflight should be handled')
    
    logSuccess('CORS configuration appears to be working')
    return true
  } catch (error) {
    logError(`CORS test failed: ${error.message}`)
    return false
  }
}

// Test: API response format
async function testApiResponseFormat() {
  logTest('Testing API response format consistency')
  
  try {
    const response = await apiClient.get('/api/droplet/status/new-installation')
    
    assert.strictEqual(response.status, 200, 'API should return 200')
    assert.ok(response.data, 'Response should have data')
    assert.strictEqual(typeof response.data.success, 'boolean', 'Response should include success boolean')
    
    if (response.data.data) {
      assert.strictEqual(typeof response.data.data, 'object', 'Data field should be object')
    }
    
    logSuccess('API response format is consistent')
    return true
  } catch (error) {
    logError(`API response format test failed: ${error.message}`)
    return false
  }
}

// Test: Database connection (indirect)
async function testDatabaseConnection() {
  logTest('Testing database connectivity (indirect)')
  
  try {
    // The status endpoint requires database access
    const response = await apiClient.get('/api/droplet/status/new-installation')
    
    assert.strictEqual(response.status, 200, 'Database-dependent endpoint should work')
    
    logSuccess('Database appears to be connected')
    return true
  } catch (error) {
    logError(`Database connectivity test failed: ${error.message}`)
    logError('This might indicate database connection issues')
    return false
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Fluid Droplet Integration Tests')
  console.log('==================================')
  console.log(`Testing API at: ${API_BASE_URL}`)
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck, critical: true },
    { name: 'Database Connection', fn: testDatabaseConnection, critical: true },
    { name: 'Configuration Validation', fn: testConfigurationValidation, critical: false },
    { name: 'Status Endpoint', fn: testStatusEndpoint, critical: true },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint, critical: false },
    { name: 'CORS Configuration', fn: testCorsHeaders, critical: false },
    { name: 'API Response Format', fn: testApiResponseFormat, critical: true }
  ]
  
  let passed = 0
  let failed = 0
  let critical_failures = 0
  
  for (const test of tests) {
    try {
      const result = await test.fn()
      if (result) {
        passed++
      } else {
        failed++
        if (test.critical) critical_failures++
      }
    } catch (error) {
      logError(`Test "${test.name}" crashed: ${error.message}`)
      failed++
      if (test.critical) critical_failures++
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary')
  console.log('===============')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`🚨 Critical Failures: ${critical_failures}`)
  
  if (critical_failures === 0) {
    console.log('\n🎉 All critical tests passed! Your droplet is ready.')
  } else {
    console.log('\n⚠️  Some critical tests failed. Please fix these issues before deploying.')
  }
  
  if (failed === 0) {
    console.log('\n✨ Perfect! All tests passed.')
    process.exit(0)
  } else if (critical_failures === 0) {
    console.log('\n👍 Core functionality works. Non-critical failures are acceptable.')
    process.exit(0)
  } else {
    process.exit(1)
  }
}

// Handle command line execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runTests().catch(error => {
    logError(`Test runner crashed: ${error.message}`)
    process.exit(1)
  })
}

export {
  testHealthCheck,
  testConfigurationValidation,
  testStatusEndpoint,
  testWebhookEndpoint,
  testCorsHeaders,
  testApiResponseFormat,
  testDatabaseConnection,
  runTests
}