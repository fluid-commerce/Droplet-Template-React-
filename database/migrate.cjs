#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * This script runs PostgreSQL migrations in order.
 * Usage: node database/migrate.js [up|down|status]
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/fluid_droplet_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const migrationsDir = path.join(__dirname, 'migrations');

// Create migrations table if it doesn't exist
async function createMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

// Get list of migration files
function getMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

// Get executed migrations
async function getExecutedMigrations(client) {
  const result = await client.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map(row => row.filename);
}

// Execute a single migration
async function executeMigration(client, filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Executing migration: ${filename}`);
  
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`✅ Migration ${filename} executed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${filename} failed:`, error.message);
    throw error;
  }
}

// Run migrations up
async function migrateUp() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    await createMigrationsTable(client);
    
    const migrationFiles = getMigrationFiles();
    const executedMigrations = await getExecutedMigrations(client);
    const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(file => console.log(`  - ${file}`));
    
    for (const filename of pendingMigrations) {
      await executeMigration(client, filename);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Show migration status
async function showStatus() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    await createMigrationsTable(client);
    
    const migrationFiles = getMigrationFiles();
    const executedMigrations = await getExecutedMigrations(client);
    
    console.log('Migration Status:');
    console.log('================');
    
    migrationFiles.forEach(file => {
      const status = executedMigrations.includes(file) ? '✅ Executed' : '⏳ Pending';
      console.log(`${status} ${file}`);
    });
    
    const pendingCount = migrationFiles.length - executedMigrations.length;
    console.log(`\nTotal: ${migrationFiles.length} migrations, ${pendingCount} pending`);
    
  } catch (error) {
    console.error('Failed to get migration status:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'up';
  
  switch (command) {
    case 'up':
      await migrateUp();
      break;
    case 'status':
      await showStatus();
      break;
    default:
      console.log('Usage: node database/migrate.js [up|status]');
      console.log('  up     - Run pending migrations');
      console.log('  status - Show migration status');
      process.exit(1);
  }
}

main().catch(console.error);
