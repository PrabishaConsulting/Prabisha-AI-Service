#!/bin/bash
# Deploy Configuration
# Customize these values for each project

# Project Details
PROJECT_NAME="aiservice"
PROJECT_PATH="/var/www/services/ai-service"
GIT_BRANCH="main"
GIT_REMOTE="origin"

# Server Configuration
PORT=3048
PM2_SERVICE_NAME="aiservice-3048"
SSH_PORT=18208
SSH_USERNAME="tvmcloud"

# Node.js Configuration
REQUIRED_NODE_VERSION="20.9.0"

# Database Configuration (optional)
# DATABASE_URL is typically in .env file
# Uncomment if you need to set it here
# export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
