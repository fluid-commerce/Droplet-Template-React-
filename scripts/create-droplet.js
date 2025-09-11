#!/usr/bin/env node

/**
 * 🚀 Fluid Droplet Creation Script
 * 
 * This script creates a new droplet in the Fluid platform using the Fluid API.
 * 
 * Usage:
 *   FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/create-droplet.js
 *   
 * Or with all options:
 *   FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid DROPLET_NAME="My Droplet" DROPLET_DESCRIPTION="My awesome integration" LOGO_URL=https://logo.com/logo.png node scripts/create-droplet.js
 */

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

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

// Get configuration from environment variables or package.json
function getConfiguration() {
  // Read package.json for defaults
  let packageJson = {}
  try {
    const packagePath = path.join(projectRoot, 'package.json')
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  } catch (error) {
    logWarning('Could not read package.json, using basic defaults')
  }

  const config = {
    fluidApiKey: process.env.FLUID_API_KEY,
    embedUrl: process.env.EMBED_URL,
    webhookUrl: process.env.WEBHOOK_URL,
    dropletName: process.env.DROPLET_NAME || packageJson.name || 'Fluid Droplet Template',
    description: process.env.DROPLET_DESCRIPTION || packageJson.description || 'A custom Fluid droplet integration',
    logoUrl: process.env.LOGO_URL || 'https://via.placeholder.com/200x200/4F46E5/FFFFFF?text=DROPLET',
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

  if (!config.embedUrl) {
    errors.push('EMBED_URL environment variable is required')
  } else {
    try {
      new URL(config.embedUrl)
    } catch (error) {
      errors.push('EMBED_URL must be a valid URL')
    }
  }

  if (!config.webhookUrl) {
    errors.push('WEBHOOK_URL environment variable is required')
  } else {
    try {
      const webhookUrl = new URL(config.webhookUrl)
      // Ensure it's HTTPS in production
      if (webhookUrl.protocol !== 'https:' && !config.webhookUrl.includes('localhost')) {
        logWarning('Webhook URL should use HTTPS for production deployments')
      }
      // Ensure it ends with the correct path
      if (!config.webhookUrl.endsWith('/api/webhooks/fluid')) {
        logWarning('Webhook URL should end with "/api/webhooks/fluid"')
      }
    } catch (error) {
      errors.push('WEBHOOK_URL must be a valid URL')
    }
  }

  if (!config.dropletName || config.dropletName.trim().length === 0) {
    errors.push('Droplet name cannot be empty')
  }

  return errors
}

// Create droplet via Fluid API
async function createDroplet(config) {
  const client = axios.create({
    baseURL: `${config.fluidApiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${config.fluidApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  })

  const dropletData = {
    name: config.dropletName,
    embed_url: config.embedUrl,
    webhook_url: config.webhookUrl,
    active: true,
    settings: {
      marketplace_page: {
        title: config.dropletName,
        summary: config.description,
        logo_url: config.logoUrl
      },
      details_page: {
        title: config.dropletName,
        summary: config.description,
        logo_url: config.logoUrl
      }
    }
  }

  logInfo(`Creating droplet: ${config.dropletName}`)
  logInfo(`Embed URL: ${config.embedUrl}`)
  logInfo(`Webhook URL: ${config.webhookUrl}`)
  logInfo(`API URL: ${config.fluidApiUrl}`)

  try {
    const response = await client.post('/droplets', {
      droplet: dropletData
    })

    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`)
    } else if (error.request) {
      throw new Error('Network Error: Could not reach Fluid API. Please check your internet connection and API URL.')
    } else {
      throw new Error(`Request Error: ${error.message}`)
    }
  }
}

// Update environment files with droplet ID
function updateEnvironmentFiles(dropletId) {
  const backendEnvPath = path.join(projectRoot, 'backend', '.env')
  const backendEnvExamplePath = path.join(projectRoot, 'backend', 'env.example')

  // Update backend/.env if it exists
  if (fs.existsSync(backendEnvPath)) {
    try {
      let envContent = fs.readFileSync(backendEnvPath, 'utf8')
      
      // Update or add DROPLET_ID
      if (envContent.includes('DROPLET_ID=')) {
        envContent = envContent.replace(/DROPLET_ID=.*$/m, `DROPLET_ID=${dropletId}`)
      } else {
        envContent += `\nDROPLET_ID=${dropletId}\n`
      }

      fs.writeFileSync(backendEnvPath, envContent)
      logSuccess(`Updated DROPLET_ID in backend/.env`)
    } catch (error) {
      logWarning(`Could not update backend/.env: ${error.message}`)
    }
  } else {
    logWarning('backend/.env not found - you may need to run setup first')
  }

  // Also update the example file for future reference
  if (fs.existsSync(backendEnvExamplePath)) {
    try {
      let envContent = fs.readFileSync(backendEnvExamplePath, 'utf8')
      envContent = envContent.replace(/DROPLET_ID=.*$/m, `DROPLET_ID=${dropletId}`)
      fs.writeFileSync(backendEnvExamplePath, envContent)
      logInfo('Updated droplet ID in backend/env.example')
    } catch (error) {
      logWarning(`Could not update backend/env.example: ${error.message}`)
    }
  }
}

// Main function
async function main() {
  log('🚀 Fluid Droplet Creation Script', 'bright')
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
      logInfo('  FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/create-droplet.js')
      console.log()
      logInfo('Required environment variables:')
      logInfo('  FLUID_API_KEY=your_fluid_api_key')
      logInfo('  EMBED_URL=https://your-frontend.com/')
      logInfo('  WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid')
      console.log()
      logInfo('Optional environment variables:')
      logInfo('  DROPLET_NAME="My Droplet"')
      logInfo('  DROPLET_DESCRIPTION="My awesome integration"')
      logInfo('  LOGO_URL=https://logo.com/logo.png')
      logInfo('  FLUID_API_URL=https://api.fluid.app (default)')
      process.exit(1)
    }

    // Create the droplet
    logInfo('Creating droplet in Fluid platform...')
    const result = await createDroplet(config)

    // Extract droplet information
    const droplet = result.droplet || result.data || result
    const dropletId = droplet.uuid || droplet.id

    if (!dropletId) {
      logError('Droplet was created but no ID was returned')
      logInfo('Response:', JSON.stringify(result, null, 2))
      process.exit(1)
    }

    // Success!
    console.log()
    logSuccess('🎉 Droplet created successfully!')
    console.log()
    log('📋 Droplet Details:', 'cyan')
    log(`   ID: ${dropletId}`, 'bright')
    log(`   Name: ${droplet.name}`)
    log(`   Embed URL: ${droplet.embed_url}`)
    log(`   Status: ${droplet.active ? 'Active' : 'Inactive'}`)
    
    // Update environment files
    console.log()
    logInfo('Updating environment files...')
    updateEnvironmentFiles(dropletId)

    // Next steps
    console.log()
    log('🚀 Next Steps:', 'cyan')
    log('1. Deploy your backend service (if not already deployed)')
    log('2. Set DROPLET_ID in your deployment environment variables')
    log('3. Run database migrations: npm run migrate')
    log('4. Test your droplet by installing it in Fluid')
    log('5. Verify webhook functionality by uninstalling/reinstalling')
    console.log()
    log('🔗 Your droplet should now be available in the Fluid platform!', 'green')
    log('📝 Important: Make sure your webhook URL is accessible from Fluid!', 'yellow')

  } catch (error) {
    console.log()
    logError('Failed to create droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet creation permissions')
      logInfo('• You are using the correct FLUID_API_URL')
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