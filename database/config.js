/**
 * Database Configuration
 * 
 * This file contains database connection and configuration settings.
 * Update the connection string based on your environment.
 */

const { Client, Pool } = require('pg');

// Database configuration
const dbConfig = {
  // Connection string for the database
  connectionString: process.env.DATABASE_URL || 'postgresql://pokey@localhost:5434/fluid_droplet_db',
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create a connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database utility functions
class Database {
  /**
   * Execute a query with parameters
   */
  static async query(text, params = []) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  static async getClient() {
    return await pool.connect();
  }

  /**
   * Execute a transaction
   */
  static async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  static async close() {
    await pool.end();
  }

  /**
   * Test database connection
   */
  static async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      console.log('✅ Database connection successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }
}

module.exports = {
  Database,
  pool,
  dbConfig
};
