#!/bin/bash

# Fluid Droplet Template - Database Setup Script
# This script helps you set up PostgreSQL for the droplet template

echo "🚀 Setting up PostgreSQL database for Fluid Droplet Template"
echo "============================================================"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first:"
    echo ""
    echo "macOS: brew install postgresql"
    echo "Ubuntu: sudo apt install postgresql postgresql-contrib"
    echo "Windows: Download from https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi

echo "✅ PostgreSQL is installed"

# Check if database exists
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw fluid_droplet_db; then
    echo "✅ Database 'fluid_droplet_db' already exists"
else
    echo "📦 Creating database 'fluid_droplet_db'..."
    createdb -U postgres fluid_droplet_db
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully"
    else
        echo "❌ Failed to create database. Make sure PostgreSQL is running and you have permissions."
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing PostgreSQL dependencies..."
cd backend && npm install

# Run migrations
echo "🔄 Running database migrations..."
node ../database/migrate.cjs up

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Database setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env file with the database URL:"
    echo "   DATABASE_URL=postgresql://postgres:password@localhost:5432/fluid_droplet_db"
    echo ""
    echo "2. Start your development server:"
    echo "   npm run dev"
    echo ""
    echo "3. Check migration status anytime with:"
    echo "   node database/migrate.cjs status"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
