#!/bin/bash
# Deploy Configuration
# Customize these values for each project

# Project Details
PROJECT_NAME="audit"
PROJECT_PATH="/var/www/pm"
GIT_BRANCH="main"
GIT_REMOTE="origin"

# Server Configuration
PORT=3039
PM2_SERVICE_NAME="pm-3039"
SSH_PORT=18208
SSH_USERNAME="tvmcloud"

# Node.js Configuration
REQUIRED_NODE_VERSION="20.9.0"

# Database Configuration (optional)
# DATABASE_URL is typically in .env file
# Uncomment if you need to set it here
# export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
