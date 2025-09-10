#!/usr/bin/env node

/**
 * Post-install script for Fluid Droplet Template
 * Shows helpful setup instructions after npm install
 */

console.log('\n🚀 Fluid Droplet Template - Dependencies Installed!');
console.log('================================================');
console.log('');
console.log('Next steps:');
console.log('');
console.log('1. 🚀 ONE-COMMAND SETUP (Recommended):');
console.log('   ./setup.sh                    # macOS/Linux');
console.log('   setup.bat                     # Windows');
console.log('   npm run setup:full           # Cross-platform');
console.log('');
console.log('2. 🔧 MANUAL SETUP (if you prefer):');
console.log('   npm run setup:db             # Set up PostgreSQL');
console.log('   # Then manually create .env files from .env.example');
console.log('   npm run migrate              # Run database migrations');
console.log('');
console.log('3. 🎯 START DEVELOPMENT:');
console.log('   npm run dev:full             # Start frontend + backend');
console.log('   npm run dev:auto             # Setup + start (if using auto-setup)');
console.log('');
console.log('📖 Full documentation: README.md');
console.log('🎉 Happy coding!');
console.log('');
