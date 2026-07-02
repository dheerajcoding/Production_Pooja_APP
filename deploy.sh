#!/bin/bash

# Auto-deployment script for Saral Pooja
# Run this on the VPS to pull latest code and redeploy

set -e  # Exit on any error

PROJECT_DIR="/var/www/saral-pooja"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "🚀 Starting deployment..."
echo "📍 Project: $PROJECT_DIR"
echo ""

# Step 1: Pull latest code
echo "📥 Pulling latest code from GitHub..."
cd "$PROJECT_DIR"
git pull origin main
echo "✅ Code pulled successfully"
echo ""

# Step 2: Install/update backend dependencies
echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --omit=dev
echo "✅ Backend dependencies installed"
echo ""

# Step 3: Install/update frontend dependencies
echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install
echo "✅ Frontend dependencies installed"
echo ""

# Step 4: Build frontend
echo "🔨 Building frontend..."
cd "$FRONTEND_DIR"
npm run build
echo "✅ Frontend built successfully"
echo ""

# Step 5: Restart backend with updated env
echo "🔄 Restarting backend..."
cd "$PROJECT_DIR"
pm2 restart saral-pooja-api --update-env
sleep 3
echo "✅ Backend restarted"
echo ""

# Step 6: Verify health
echo "🏥 Checking health..."
if curl -s http://127.0.0.1:5000/api/health | grep -q "success"; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend health check failed"
fi
echo ""

# Step 7: Reload nginx (clear cache)
echo "🔄 Reloading nginx..."
systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

echo "✨ Deployment completed successfully!"
echo "🌐 Your app is live at: http://147.93.108.75"
