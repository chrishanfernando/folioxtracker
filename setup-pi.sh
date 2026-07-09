#!/bin/bash
set -e

# ============================================================
# Portfolio App - Raspberry Pi Setup Script
# Run this on your Pi after transferring the project files
# Usage: chmod +x setup-pi.sh && ./setup-pi.sh
# ============================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="portfolio"
NODE_VERSION="20"

echo "========================================="
echo "  Portfolio App - Raspberry Pi Setup"
echo "========================================="
echo ""
echo "App directory: $APP_DIR"
echo ""

# --- 1. System dependencies ---
echo "[1/7] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git nginx > /dev/null 2>&1
echo "  Done."

# --- 2. Node.js ---
if command -v node &> /dev/null && [[ "$(node -v)" == v${NODE_VERSION}* ]]; then
    echo "[2/7] Node.js $(node -v) already installed. Skipping."
else
    echo "[2/7] Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo bash - > /dev/null 2>&1
    sudo apt-get install -y -qq nodejs > /dev/null 2>&1
    echo "  Installed Node.js $(node -v)"
fi

# --- 3. Swap (needed for builds on low-memory Pis) ---
echo "[3/7] Ensuring adequate swap for builds..."
CURRENT_SWAP=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$CURRENT_SWAP" -lt 1024 ]; then
    echo "  Increasing swap to 2GB (currently ${CURRENT_SWAP}MB)..."
    sudo dphys-swapfile swapoff 2>/dev/null || true
    sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    sudo dphys-swapfile setup > /dev/null 2>&1
    sudo dphys-swapfile swapon
    echo "  Swap increased to 2GB."
else
    echo "  Swap is ${CURRENT_SWAP}MB. Sufficient."
fi

# --- 4. Environment variables ---
ENV_FILE="$APP_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "[4/7] Creating .env.local..."
    JWT_SECRET=$(openssl rand -hex 32)
    CRON_SECRET=$(openssl rand -hex 16)
    cat > "$ENV_FILE" <<EOF
TURSO_DATABASE_URL=file:local.db
JWT_SECRET=${JWT_SECRET}
CRON_SECRET=${CRON_SECRET}
# Optional: Resend email
# RESEND_API_KEY=
# Optional: Remote Turso database
# TURSO_AUTH_TOKEN=
EOF
    echo "  Created $ENV_FILE with generated secrets."
else
    echo "[4/7] .env.local already exists. Skipping."
fi

# --- 5. Install dependencies & build ---
echo "[5/7] Installing npm dependencies (this may take a few minutes)..."
cd "$APP_DIR"
npm install --production=false 2>&1 | tail -1

echo "[5/7] Building the app (this may take several minutes on a Pi)..."
npm run build 2>&1 | tail -5

echo "[5/7] Pushing database schema..."
npx drizzle-kit push 2>&1 | tail -3
echo "  Build complete."

# --- 6. PM2 process manager ---
echo "[6/7] Setting up PM2 for auto-start..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 > /dev/null 2>&1
fi

cd "$APP_DIR"
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start npm --name "$APP_NAME" -- start
pm2 save

# Enable PM2 startup on boot
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
    echo "  Running PM2 startup command..."
    eval "$PM2_STARTUP" > /dev/null 2>&1
fi
echo "  PM2 configured. App will auto-start on boot."

# --- 7. Nginx reverse proxy ---
echo "[7/7] Configuring nginx reverse proxy on port 80..."
sudo tee /etc/nginx/sites-available/portfolio > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t > /dev/null 2>&1
sudo systemctl restart nginx
sudo systemctl enable nginx > /dev/null 2>&1
echo "  Nginx configured."

# --- Done ---
PI_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "  Access your app at:"
echo "    http://${PI_IP}"
echo "    http://$(hostname).local  (if mDNS works)"
echo ""
echo "  Useful commands:"
echo "    pm2 status          - check app status"
echo "    pm2 logs portfolio  - view logs"
echo "    pm2 restart portfolio - restart after changes"
echo ""
echo "  To update after code changes:"
echo "    cd $APP_DIR"
echo "    npm run build && pm2 restart portfolio"
echo ""
echo "  Cron job for price updates (optional):"
echo "    crontab -e"
echo "    # Add: 0 8 * * * curl -s -H \"Authorization: Bearer \$(grep CRON_SECRET $ENV_FILE | cut -d= -f2)\" http://localhost:3000/api/cron/prices"
echo ""
