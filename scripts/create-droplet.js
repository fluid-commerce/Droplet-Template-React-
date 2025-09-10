#!/usr/bin/env node

/**
 * Create Droplet Script
 * 
 * This script helps developers create a new droplet in the Fluid platform.
 * Run this after deploying your droplet to get the droplet UUID.
 * 
 * Usage:
 * 1. Set your FLUID_API_KEY in the environment or update the script
 * 2. Update the EMBED_URL to your deployed frontend URL
 * 3. Optionally set LOGO_URL to your custom logo (defaults to placeholder)
 * 4. Run: node scripts/create-droplet.js
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
const EMBED_URL = process.env.EMBED_URL || 'https://your-droplet-frontend.onrender.com/';
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

async function createDroplet() {
  console.log('🚀 Creating Fluid Droplet...');
  console.log(`📦 App Name: ${appName}`);
  console.log(`📝 Description: ${appDescription}`);
  console.log(`🔗 Embed URL: ${EMBED_URL}`);
  console.log(`🖼️  Logo URL: ${LOGO_URL}`);
  console.log('');

  if (FLUID_API_KEY === 'YOUR_FLUID_API_KEY_HERE') {
    console.error('❌ Please set your FLUID_API_KEY environment variable or update the script');
    console.log('   Example: FLUID_API_KEY=your_key_here node scripts/create-droplet.js');
    console.log('   Optional: LOGO_URL=https://your-logo-url.com/logo.png');
    process.exit(1);
  }

  try {
    const response = await axios.post(`${FLUID_API_URL}/api/droplets`, {
      droplet: {
        name: appName,
        embed_url: EMBED_URL,
        active: true,
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

    const dropletId = response.data.droplet?.uuid;
    
    if (!dropletId) {
      console.error('❌ Failed to get droplet ID from response');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return;
    }

    console.log('✅ Droplet created successfully!');
    console.log('');
    console.log('📋 Droplet Details:');
    console.log(`   Name: ${response.data.droplet.name}`);
    console.log(`   UUID: ${dropletId}`);
    console.log(`   Embed URL: ${response.data.droplet.embed_url}`);
    console.log(`   Active: ${response.data.droplet.active}`);
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. Update your backend environment variables:');
    console.log(`   DROPLET_ID=${dropletId}`);
    console.log('');
    console.log('2. Update your render.yaml file:');
    console.log(`   - key: DROPLET_ID`);
    console.log(`     value: ${dropletId}`);
    console.log('');
    console.log('3. Redeploy your backend with the new DROPLET_ID');
    console.log('');
    console.log('4. Test your droplet installation flow');
    console.log('');
    console.log('🎉 Your droplet is ready to use!');

    return dropletId;
  } catch (error) {
    console.error('❌ Failed to create droplet:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('');
      console.log('💡 This looks like an authentication error. Please check:');
      console.log('   - Your FLUID_API_KEY is correct');
      console.log('   - Your API key has permission to create droplets');
    }
    
    process.exit(1);
  }
}

// Run the script
createDroplet().catch(console.error);
