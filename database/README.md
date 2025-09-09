# Database Setup

This directory contains the PostgreSQL database setup for the Fluid Droplet Template.

## 📁 Structure

```
database/
├── migrations/           # SQL migration files
│   ├── 001_create_droplet_installations.sql
│   ├── 002_create_activity_logs.sql
│   ├── 003_create_webhook_events.sql
│   └── 004_create_custom_data.sql
├── config.js            # Database configuration
├── migrate.js           # Migration runner script
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fluid_droplet_db;

# Create user (optional)
CREATE USER droplet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE fluid_droplet_db TO droplet_user;

# Exit
\q
```

### 3. Set Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/fluid_droplet_db

# For production, use your hosted database URL
# DATABASE_URL=postgresql://user:pass@host:port/database
```

### 4. Run Migrations

```bash
# From the project root
node database/migrate.js up
```

## 📊 Database Schema

### Tables Created:

1. **`droplet_installations`** - Stores droplet installation data and configurations
2. **`activity_logs`** - Tracks all activities and events for droplet installations
3. **`webhook_events`** - Stores incoming webhook events from Fluid platform
4. **`custom_data`** - Stores custom data specific to each droplet installation

### Key Features:

- **UUID Primary Keys** - All tables use UUIDs for better scalability
- **JSONB Columns** - Flexible data storage for configurations and payloads
- **Foreign Key Constraints** - Ensures data integrity
- **Indexes** - Optimized for common query patterns
- **Timestamps** - Automatic created_at and updated_at tracking

## 🔧 Migration Commands

```bash
# Run all pending migrations
node database/migrate.js up

# Check migration status
node database/migrate.js status
```

## 🏗️ Adding New Migrations

1. Create a new SQL file in the `migrations/` directory
2. Use the naming convention: `XXX_description.sql` (e.g., `005_add_user_preferences.sql`)
3. Run the migration: `node database/migrate.js up`

## 🔍 Database Usage in Code

```javascript
const { Database } = require('./database/config');

// Execute a query
const result = await Database.query(
  'SELECT * FROM droplet_installations WHERE installation_id = $1',
  [installationId]
);

// Use a transaction
await Database.transaction(async (client) => {
  await client.query('INSERT INTO activity_logs ...');
  await client.query('UPDATE droplet_installations ...');
});
```

## 🚀 Production Deployment

### Render.com
```bash
# Set environment variable in Render dashboard
DATABASE_URL=postgresql://user:pass@host:port/database

# Run migrations during deployment
node database/migrate.js up
```

### Heroku
```bash
# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Run migrations
heroku run node database/migrate.js up
```

### Docker
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fluid_droplet_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🔒 Security Notes

- **Never commit database credentials** to version control
- **Use environment variables** for all database configuration
- **Enable SSL** in production environments
- **Use connection pooling** to prevent connection exhaustion
- **Validate all inputs** before database queries

## 🐛 Troubleshooting

### Connection Issues
```bash
# Test database connection
node -e "require('./database/config').Database.testConnection()"
```

### Migration Issues
```bash
# Check migration status
node database/migrate.js status

# Check database logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Performance Issues
- Check if indexes are being used: `EXPLAIN ANALYZE SELECT ...`
- Monitor connection pool usage
- Consider read replicas for high-traffic applications
