#!/usr/bin/env node

/**
 * Update Droplet Script
 * 
 * This script updates an existing droplet in the Fluid platform with new logo and description.
 * 
 * Usage:
 * 1. Set your FLUID_API_KEY in the environment
 * 2. Set your DROPLET_ID (the UUID of your existing droplet)
 * 3. Optionally set LOGO_URL to your custom logo (defaults to your Cloudinary logo)
 * 4. Run: node scripts/update-droplet.js
 */

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration - Update these values for your droplet
const FLUID_API_URL = 'https://api.fluid.app';
const FLUID_API_KEY = process.env.FLUID_API_KEY || 'YOUR_FLUID_API_KEY_HERE';
const DROPLET_ID = process.env.DROPLET_ID || 'YOUR_DROPLET_ID_HERE';
const LOGO_URL = process.env.LOGO_URL || 'https://res.cloudinary.com/ddway3wcc/image/upload/v1751920946/business-logos/revb5zhzz38shehvdxlq.png';

// Read package.json for app name and description
let appName = 'Fluid Droplet Template';
let appDescription = 'A React + TypeScript template for creating Fluid droplet services';
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  appName = packageJson.name || appName;
  appDescription = packageJson.description || appDescription;
} catch (error) {
  console.log('Using default app name and description');
}

async function updateDroplet() {
  console.log('🔄 Updating Fluid Droplet...');
  console.log(`📦 App Name: ${appName}`);
  console.log(`📝 Description: ${appDescription}`);
  console.log(`🆔 Droplet ID: ${DROPLET_ID}`);
  console.log(`🖼️  Logo URL: ${LOGO_URL}`);
  console.log('');

  if (FLUID_API_KEY === 'YOUR_FLUID_API_KEY_HERE') {
    console.error('❌ Please set your FLUID_API_KEY environment variable');
    console.log('   Example: FLUID_API_KEY=your_key_here node scripts/update-droplet.js');
    process.exit(1);
  }

  if (DROPLET_ID === 'YOUR_DROPLET_ID_HERE') {
    console.error('❌ Please set your DROPLET_ID environment variable');
    console.log('   Example: DROPLET_ID=your_droplet_uuid node scripts/update-droplet.js');
    process.exit(1);
  }

  try {
    const response = await axios.patch(`${FLUID_API_URL}/api/droplets/${DROPLET_ID}`, {
      droplet: {
        name: appName,
        settings: {
          marketplace_page: {
            title: appName,
            summary: appDescription,
            logo_url: LOGO_URL
          },
          details_page: {
            title: appName,
            summary: appDescription,
            logo_url: LOGO_URL
          }
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${FLUID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Droplet updated successfully!');
    console.log('');
    console.log('📋 Updated Droplet Details:');
    console.log(`   Name: ${response.data.droplet.name}`);
    console.log(`   UUID: ${response.data.droplet.uuid}`);
    console.log(`   Active: ${response.data.droplet.active}`);
    console.log('');
    console.log('🎉 Your droplet now has the proper logo and description!');

    return response.data.droplet.uuid;
  } catch (error) {
    console.error('❌ Failed to update droplet:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('');
      console.log('💡 This looks like an authentication error. Please check:');
      console.log('   - Your FLUID_API_KEY is correct');
      console.log('   - Your API key has permission to update droplets');
    }
    
    if (error.response?.status === 404) {
      console.log('');
      console.log('💡 This looks like the droplet was not found. Please check:');
      console.log('   - Your DROPLET_ID is correct');
      console.log('   - The droplet exists in your account');
    }
    
    process.exit(1);
  }
}

// Run the script
updateDroplet().catch(console.error);
