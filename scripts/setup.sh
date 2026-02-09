#!/bin/bash

# CLM Automation Setup Script
# Usage: ./scripts/setup.sh [environment]

set -e  # Exit on error

ENV=${1:-development}
echo "Setting up CLM Automation for $ENV environment..."

# Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is recommended but not installed. Some features may not work."; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is recommended but not installed."; }

# Create environment file if it doesn't exist
if [ ! -f "../.env" ]; then
    echo "Creating .env file from template..."
    cp ../.env.example ../.env
    echo "Please edit ../.env file with your configuration."
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd ../backend
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install

# Set up database
echo "Setting up database..."
cd ..
if command -v docker-compose &> /dev/null; then
    echo "Starting PostgreSQL with Docker Compose..."
    docker-compose up -d postgres
    echo "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    echo "Running database migrations..."
    docker-compose exec -T postgres psql -U clm_admin -d clm_automation -f /docker-entrypoint-initdb.d/init.sql
else
    echo "Docker Compose not found. Please set up PostgreSQL manually."
    echo "Run the SQL in database/init.sql on your PostgreSQL instance."
fi

echo ""
echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your AWS credentials and other settings"
echo "2. Start the application:"
echo "   - With Docker: docker-compose up -d"
echo "   - Manually:"
echo "     - Backend: cd backend && npm run dev"
echo "     - Frontend: cd frontend && npm start"
echo ""
echo "Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   pgAdmin (if enabled): http://localhost:5050"
