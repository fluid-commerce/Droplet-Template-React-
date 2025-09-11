#!/usr/bin/env node

/**
 * 🔄 Fluid Droplet Update Script
 * 
 * This script updates an existing droplet in the Fluid platform with webhook URL configuration.
 * Use this to fix droplets that were created without webhook URLs.
 * 
 * Usage:
 *   FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/update-droplet.js
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
    webhookUrl: process.env.WEBHOOK_URL,
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

  if (!config.webhookUrl) {
    errors.push('WEBHOOK_URL environment variable is required')
  } else {
    try {
      new URL(config.webhookUrl)
    } catch (error) {
      errors.push('WEBHOOK_URL must be a valid URL')
    }
  }

  return errors
}

// Update droplet via Fluid API
async function updateDroplet(config) {
  const client = axios.create({
    baseURL: `${config.fluidApiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${config.fluidApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  })

  // First, get the current droplet configuration
  logInfo('Fetching current droplet configuration...')
  let currentDroplet
  try {
    const getResponse = await client.get(`/droplets/${config.dropletId}`)
    currentDroplet = getResponse.data.droplet || getResponse.data
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Droplet with ID ${config.dropletId} not found`)
    }
    throw error
  }

  logSuccess(`Found droplet: ${currentDroplet.name}`)
  logInfo(`Current embed URL: ${currentDroplet.embed_url}`)
  logInfo(`Current webhook URL: ${currentDroplet.webhook_url || 'NOT SET'}`)

  // Update with webhook URL - try minimal update first
  const updatedDropletData = {
    webhook_url: config.webhookUrl
  }

  logInfo(`Updating droplet with webhook URL: ${config.webhookUrl}`)
  logInfo(`Sending update data: ${JSON.stringify({ droplet: updatedDropletData }, null, 2)}`)

  try {
    // Try PATCH first for partial updates
    const response = await client.patch(`/droplets/${config.dropletId}`, {
      droplet: updatedDropletData
    })

    return response.data
  } catch (error) {
    if (error.response) {
      // Log more details about the error for debugging
      logError(`Full error response: ${JSON.stringify(error.response.data, null, 2)}`)
      throw new Error(`API Error ${error.response.status}: ${error.response.data?.message || JSON.stringify(error.response.data) || error.response.statusText}`)
    } else if (error.request) {
      throw new Error('Network Error: Could not reach Fluid API. Please check your internet connection and API URL.')
    } else {
      throw new Error(`Request Error: ${error.message}`)
    }
  }
}

// Main function
async function main() {
  log('🔄 Fluid Droplet Update Script', 'bright')
  log('=================================', 'bright')
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
      logInfo('  FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/update-droplet.js')
      console.log()
      logInfo('Required environment variables:')
      logInfo('  FLUID_API_KEY=your_fluid_api_key')
      logInfo('  DROPLET_ID=your_droplet_id')
      logInfo('  WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid')
      console.log()
      logInfo('Optional environment variables:')
      logInfo('  FLUID_API_URL=https://api.fluid.app (default)')
      process.exit(1)
    }

    // Update the droplet
    logInfo('Updating droplet in Fluid platform...')
    const result = await updateDroplet(config)

    // Extract droplet information
    const droplet = result.droplet || result.data || result

    // Success!
    console.log()
    logSuccess('🎉 Droplet updated successfully!')
    console.log()
    log('📋 Updated Droplet Details:', 'cyan')
    log(`   ID: ${config.dropletId}`, 'bright')
    log(`   Name: ${droplet.name}`)
    log(`   Embed URL: ${droplet.embed_url}`)
    log(`   Webhook URL: ${droplet.webhook_url}`)
    log(`   Status: ${droplet.active ? 'Active' : 'Inactive'}`)
    
    console.log()
    log('🚀 Next Steps:', 'cyan')
    log('1. Test your droplet by uninstalling and reinstalling it in Fluid')
    log('2. Check your backend logs to confirm webhook events are being received')
    log('3. Verify that uninstall now properly removes the installation')
    console.log()
    log('🔗 Your droplet should now properly handle uninstall webhooks!', 'green')

  } catch (error) {
    console.log()
    logError('Failed to update droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet update permissions')
      logInfo('• You are using the correct FLUID_API_URL')
    } else if (error.message.includes('404')) {
      console.log()
      logInfo('Droplet not found? Check that:')
      logInfo('• Your DROPLET_ID is correct')
      logInfo('• The droplet exists in your Fluid account')
      logInfo('• You have permission to access this droplet')
    } else if (error.message.includes('Network')) {
      console.log()
      logInfo('Network issues? Check that:')
      logInfo('• You have an internet connection')
      logInfo('• The FLUID_API_URL is accessible')
      logInfo('• There are no firewall restrictions')
    }
    
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught error: ${error.message}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}`)
  logError(`Reason: ${reason}`)
  process.exit(1)
})

// Run the script
main()