#!/bin/bash
# Auto-deployment script for Saral Pooja
# Run on VPS: bash deploy.sh
set -e

PROJECT_DIR="/var/www/saral-pooja"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
UPLOADS_DIR="$BACKEND_DIR/uploads"
SERVER_IP="${SERVER_IP:-72.62.192.33}"

echo "🚀 Deploying Saral Pooja"
echo "📍 $PROJECT_DIR"
echo ""

# ─── 1. Pull latest ─────────────────────────────────────────────────────────
echo "📥 Pulling from GitHub..."
cd "$PROJECT_DIR"
git pull origin main
echo "✅ Code updated"
echo ""

# ─── 2. Backend deps ────────────────────────────────────────────────────────
echo "📦 Backend deps..."
cd "$BACKEND_DIR"
npm install --omit=dev --silent
echo "✅ Backend ready"
echo ""

# ─── 3. Frontend deps + build (with vite permission fix) ────────────────────
if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/package.json" ]; then
    echo "📦 Frontend deps..."
    cd "$FRONTEND_DIR"
    npm install --silent

    echo "🔨 Building frontend..."
    # Fix: git clone on Linux drops exec bit on node_modules/.bin/* — restore it
    if [ -f node_modules/.bin/vite ]; then
        chmod +x node_modules/.bin/vite || true
    fi
    chmod +x node_modules/.bin/* 2>/dev/null || true

    # Try build; if it fails, try via npx as fallback
    if ! npm run build; then
        echo "⚠️  npm run build failed, retrying via npx..."
        npx vite build
    fi
    echo "✅ Frontend built"
    echo ""
fi

# ─── 4. Ensure upload folders exist with correct permissions ────────────────
echo "📁 Fixing upload folders..."
mkdir -p "$UPLOADS_DIR"/{profiles,poojas,products,chat,videos,completions}
# Group ownership must let nginx (www-data) read files that Node (root) writes
chown -R root:www-data "$UPLOADS_DIR"
find "$UPLOADS_DIR" -type d -exec chmod 755 {} \;
find "$UPLOADS_DIR" -type f -exec chmod 644 {} \;
echo "✅ Uploads writable + readable by nginx"
echo ""

# ─── 5. Restart backend ─────────────────────────────────────────────────────
echo "🔄 Restarting backend..."
cd "$PROJECT_DIR"
pm2 restart saral-pooja-api --update-env || pm2 start ecosystem.config.js
sleep 3

# Health check
if curl -sf http://127.0.0.1:5000/api/health > /dev/null; then
    echo "✅ Backend healthy"
else
    echo "⚠️  Backend health check failed — check: pm2 logs saral-pooja-api"
fi
echo ""

# ─── 6. Nginx: sync config from repo and reload ─────────────────────────────
NGINX_SITE="/etc/nginx/sites-available/saral-pooja"
REPO_NGINX="$PROJECT_DIR/nginx.conf"

if [ -f "$REPO_NGINX" ]; then
    # Only overwrite if changed (avoids needless reloads)
    if ! cmp -s "$REPO_NGINX" "$NGINX_SITE" 2>/dev/null; then
        echo "🔧 Nginx config changed — updating..."
        cp "$REPO_NGINX" "$NGINX_SITE"
        ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/saral-pooja
        if nginx -t; then
            systemctl reload nginx
            echo "✅ Nginx reloaded with new config"
        else
            echo "❌ Nginx config invalid — NOT reloading. Fix and re-run."
            exit 1
        fi
    else
        echo "✅ Nginx config unchanged"
    fi
fi

echo ""
echo "✨ Deployment completed successfully!"
echo "🌐 Your app is live at: http://$SERVER_IP"
echo ""
echo "Quick checks:"
echo "  pm2 status"
echo "  curl -I http://$SERVER_IP/api/health"
echo "  curl -I http://$SERVER_IP/uploads/profiles/"
