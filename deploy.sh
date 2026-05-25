#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Move to project directory
cd /var/www/services/ai-service

# Git operations are handled by GitHub Actions workflow
# No need to pull again here

# Load nvm if available to ensure correct Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check Node.js version
REQUIRED_NODE_VERSION="20.9.0"
CURRENT_NODE_VERSION=$(node -v | sed 's/v//')

echo "📌 Current Node version: v$CURRENT_NODE_VERSION"
echo "📌 Required Node version: v$REQUIRED_NODE_VERSION"

# Compare versions
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$CURRENT_NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    echo "⚠️  Node.js version is too old. Please upgrade to v20.9.0 or higher."
    echo "💡 Run: nvm install 20 && nvm use 20 && nvm alias default 20"
    exit 1
fi

# Ensure pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "📌 pnpm version: $(pnpm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
pnpm prisma generate

# Push database schema changes
echo "🗄️ Pushing database schema..."
pnpm prisma db push

# Build the application
echo "🏗️ Building application..."
pnpm build 2>&1 | tee build.log
BUILD_EXIT_CODE=${PIPESTATUS[0]}

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build command failed with exit code $BUILD_EXIT_CODE"
    echo "📋 Last 50 lines of build output:"
    tail -50 build.log
    exit 1
fi

# Check if build was successful
if [ ! -f "dist/src/main.js" ]; then
    echo "❌ Build failed! dist/src/main.js not found."
    exit 1
fi

echo "✅ Build successful! dist/src/main.js created."

# Cleanup any leftover build workers
echo "🧹 Cleaning up build workers..."
pkill -9 -f "jest-worker/processChild.js" || true

# Flush PM2 logs
echo "🧾 Flushing PM2 logs..."
pm2 flush

# Start or restart PM2 process
echo "🔁 Starting/Restarting PM2 process..."
if pm2 describe aiservice-3048 > /dev/null 2>&1; then
    echo "♻️  Restarting existing process..."
    PORT=3048 pm2 restart aiservice-3048
else
    echo "🆕 Creating new process..."
    PORT=3048 pm2 start dist/src/main.js --name aiservice-3048 -i 1
fi

echo "✅ Deployment completed successfully!"
