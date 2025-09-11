#!/usr/bin/env node

/**
 * 🗑️ Fluid Droplet Deletion Script
 * 
 * This script deletes a droplet from the Fluid platform.
 * WARNING: This action cannot be undone!
 * 
 * Usage:
 *   FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id node scripts/delete-droplet.js
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

// Delete droplet
async function deleteDroplet(config) {
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
    const response = await client.delete(`/droplets/${config.dropletId}`)
    return response.data
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Droplet with ID ${config.dropletId} not found`)
    }
    throw error
  }
}

// Main function
async function main() {
  log('🗑️ Fluid Droplet Deletion Script', 'bright')
  log('==================================', 'bright')
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
      logInfo('  FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id node scripts/delete-droplet.js')
      process.exit(1)
    }

    // Show warning
    logWarning('⚠️  WARNING: This will permanently delete the droplet!')
    logWarning('⚠️  This action cannot be undone!')
    console.log()
    logInfo(`Droplet ID: ${config.dropletId}`)
    logInfo(`API URL: ${config.fluidApiUrl}`)
    console.log()

    // Ask for confirmation
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const answer = await new Promise((resolve) => {
      rl.question('Are you sure you want to delete this droplet? Type "DELETE" to confirm: ', resolve)
    })
    rl.close()

    if (answer !== 'DELETE') {
      logInfo('Deletion cancelled.')
      process.exit(0)
    }

    // Delete the droplet
    logInfo('Deleting droplet from Fluid platform...')
    const result = await deleteDroplet(config)

    // Success!
    console.log()
    logSuccess('🎉 Droplet deleted successfully!')
    console.log()
    log('📋 Deletion Details:', 'cyan')
    log(`   ID: ${config.dropletId}`, 'bright')
    log(`   Status: Deleted`)
    
    console.log()
    log('🚀 Next Steps:', 'cyan')
    log('1. Create a new droplet with proper webhook configuration')
    log('2. Test the complete workflow from creation to uninstall')
    log('3. Verify webhook events are received properly')
    console.log()
    log('🔗 Ready to create a new droplet!', 'green')

  } catch (error) {
    console.log()
    logError('Failed to delete droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet deletion permissions')
    } else if (error.message.includes('404')) {
      console.log()
      logInfo('Droplet not found? Check that:')
      logInfo('• The DROPLET_ID is correct')
      logInfo('• The droplet exists in your Fluid account')
    }
    
    process.exit(1)
  }
}

// Run the script
main()
