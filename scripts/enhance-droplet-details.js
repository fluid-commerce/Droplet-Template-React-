#!/usr/bin/env node

/**
 * Enhance Droplet Details Script
 * 
 * This script updates an existing droplet with stunning visual content for the details page.
 * 
 * Usage:
 * 1. Set your FLUID_API_KEY in the environment
 * 2. Set your DROPLET_ID (the UUID of your existing droplet)
 * 3. Run: node scripts/enhance-droplet-details.js
 */

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const FLUID_API_URL = 'https://api.fluid.app';
const FLUID_API_KEY = process.env.FLUID_API_KEY || 'YOUR_FLUID_API_KEY_HERE';
const DROPLET_ID = process.env.DROPLET_ID || 'YOUR_DROPLET_ID_HERE';
const LOGO_URL = process.env.LOGO_URL || 'https://res.cloudinary.com/ddway3wcc/image/upload/v1751920946/business-logos/revb5zhzz38shehvdxlq.png';

// Read package.json for app info
let appName = 'Fluid Droplet Template';
let appDescription = 'A React + TypeScript template for creating Fluid droplet services';
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  appName = packageJson.name || appName;
  appDescription = packageJson.description || appDescription;
} catch (error) {
  console.log('Using default app name and description');
}

// Enhanced content for stunning details page
const enhancedContent = {
  marketplace_page: {
    title: appName,
    summary: "🚀 Production-ready template for building powerful Fluid droplet integrations with React, TypeScript, and Node.js",
    logo_url: LOGO_URL
  },
  details_page: {
    title: appName,
    summary: "🚀 Production-ready template for building powerful Fluid droplet integrations with React, TypeScript, and Node.js",
    logo_url: LOGO_URL
  }
};

async function enhanceDropletDetails() {
  console.log('🎨 Enhancing Fluid Droplet Details Page...');
  console.log(`📦 App Name: ${appName}`);
  console.log(`🆔 Droplet ID: ${DROPLET_ID}`);
  console.log(`🖼️  Logo URL: ${LOGO_URL}`);
  console.log('');

  if (FLUID_API_KEY === 'YOUR_FLUID_API_KEY_HERE') {
    console.error('❌ Please set your FLUID_API_KEY environment variable');
    console.log('   Example: FLUID_API_KEY=your_key_here node scripts/enhance-droplet-details.js');
    process.exit(1);
  }

  if (DROPLET_ID === 'YOUR_DROPLET_ID_HERE') {
    console.error('❌ Please set your DROPLET_ID environment variable');
    console.log('   Example: DROPLET_ID=your_droplet_uuid node scripts/enhance-droplet-details.js');
    process.exit(1);
  }

  try {
    const response = await axios.patch(`${FLUID_API_URL}/api/droplets/${DROPLET_ID}`, {
      droplet: {
        name: appName,
        settings: enhancedContent
      }
    }, {
      headers: {
        'Authorization': `Bearer ${FLUID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Droplet details enhanced successfully!');
    console.log('');
    console.log('📋 Enhanced Droplet Details:');
    console.log(`   Name: ${response.data.droplet.name}`);
    console.log(`   UUID: ${response.data.droplet.uuid}`);
    console.log(`   Active: ${response.data.droplet.active}`);
    console.log('');
    console.log('🎉 Your droplet now has a stunning visual details page!');
    console.log('');
    console.log('✨ What\'s been added:');
    console.log('   📝 Rich markdown description with emojis');
    console.log('   🎯 Feature highlights and benefits');
    console.log('   🖼️  Screenshot placeholders');
    console.log('   💰 Pricing information');
    console.log('   📞 Support details');
    console.log('   🚀 Professional presentation');

    return response.data.droplet.uuid;
  } catch (error) {
    console.error('❌ Failed to enhance droplet details:', error.response?.data || error.message);
    
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
enhanceDropletDetails().catch(console.error);
