#!/usr/bin/env node

/**
 * 🔍 Fluid Droplet Configuration Checker
 * 
 * This script checks your droplet configuration in Fluid to ensure everything is set up correctly.
 * 
 * Usage:
 *   FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id node scripts/check-droplet.js
 */

import axios from 'axios'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

// Get configuration from environment variables
function getConfiguration() {
  const config = {
    fluidApiKey: process.env.FLUID_API_KEY,
    dropletId: process.env.DROPLET_ID,
    fluidApiUrl: process.env.FLUID_API_URL || 'https://api.fluid.app'
  }
  return config
}

// Validate configuration
function validateConfiguration(config) {
  const errors = []

  if (!config.fluidApiKey) {
    errors.push('FLUID_API_KEY environment variable is required')
  } else if (!config.fluidApiKey.startsWith('PT-')) {
    logWarning('API key should start with "PT-" - please verify this is correct')
  }

  if (!config.dropletId) {
    errors.push('DROPLET_ID environment variable is required')
  }

  return errors
}

// Check droplet configuration
async function checkDroplet(config) {
  const client = axios.create({
    baseURL: `${config.fluidApiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${config.fluidApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  })

  try {
    const response = await client.get(`/droplets/${config.dropletId}`)
    return response.data.droplet || response.data
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Droplet with ID ${config.dropletId} not found`)
    }
    throw error
  }
}

// Main function
async function main() {
  log('🔍 Fluid Droplet Configuration Checker', 'bright')
  log('======================================', 'bright')
  console.log()

  try {
    // Get and validate configuration
    const config = getConfiguration()
    const validationErrors = validateConfiguration(config)

    if (validationErrors.length > 0) {
      logError('Configuration errors:')
      validationErrors.forEach(error => logError(`  • ${error}`))
      console.log()
      logInfo('Usage:')
      logInfo('  FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id node scripts/check-droplet.js')
      process.exit(1)
    }

    // Check the droplet
    logInfo('Checking droplet configuration...')
    const droplet = await checkDroplet(config)

    // Display results
    console.log()
    log('📋 Droplet Configuration:', 'cyan')
    log(`   ID: ${droplet.uuid || droplet.id}`, 'bright')
    log(`   Name: ${droplet.name}`)
    log(`   Status: ${droplet.active ? 'Active' : 'Inactive'}`)
    log(`   Embed URL: ${droplet.embed_url || 'Not set'}`)
    log(`   Webhook URL: ${droplet.webhook_url || 'Not set'}`)
    
    // Check for issues
    console.log()
    log('🔍 Configuration Analysis:', 'cyan')
    
    let hasIssues = false
    
    if (!droplet.embed_url) {
      logError('❌ Embed URL is not set')
      hasIssues = true
    } else {
      logSuccess('✅ Embed URL is configured')
    }
    
    if (!droplet.webhook_url) {
      logError('❌ Webhook URL is not set - uninstall events will not work!')
      hasIssues = true
    } else {
      logSuccess('✅ Webhook URL is configured')
      
      // Check if webhook URL ends with correct path
      if (!droplet.webhook_url.endsWith('/api/webhooks/fluid')) {
        logWarning('⚠️  Webhook URL should end with "/api/webhooks/fluid"')
        hasIssues = true
      }
    }
    
    if (!droplet.active) {
      logWarning('⚠️  Droplet is inactive')
      hasIssues = true
    } else {
      logSuccess('✅ Droplet is active')
    }
    
    console.log()
    if (hasIssues) {
      logWarning('⚠️  Configuration issues found!')
      logInfo('Run the update script to fix webhook URL:')
      logInfo(`  FLUID_API_KEY=${config.fluidApiKey} DROPLET_ID=${config.dropletId} WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/update-droplet.js`)
    } else {
      logSuccess('🎉 Droplet configuration looks good!')
    }

  } catch (error) {
    console.log()
    logError('Failed to check droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet read permissions')
    }
    
    process.exit(1)
  }
}

// Run the script
main()
