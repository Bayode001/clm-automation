# CLM Automation System

## Contract Lifecycle Management Automation Platform

### Overview
A modern web application for automating contract management from creation to renewal. Features include centralized storage, lifecycle tracking, automated notifications, and e-signature integration.

### Tech Stack
- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, Bootstrap
- **Storage**: AWS S3 for documents
- **Container**: Docker, Docker Compose

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd clm-automation

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services
docker-compose up -d
