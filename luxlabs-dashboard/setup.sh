#!/bin/bash
set -e

echo "=========================================="
echo "LuxLabs Dashboard Setup"
echo "=========================================="

# Variables
INSTALL_DIR="/opt/luxlabs/dashboard"
PM2_NAME="luxlabs-dashboard"
PORT=9000

# Check if running as root for directory creation
if [ ! -d "$INSTALL_DIR" ]; then
  echo "[1/8] Creating install directory..."

  # Try with sudo first
  if sudo -n mkdir -p "$INSTALL_DIR" 2>/dev/null && sudo -n chown $USER:$USER "$INSTALL_DIR" 2>/dev/null; then
    echo "   Created $INSTALL_DIR with sudo"
  # Fall back to user home directory if sudo not available
  elif mkdir -p ~/luxlabs-dashboard 2>/dev/null; then
    INSTALL_DIR=~/luxlabs-dashboard
    echo "   ⚠ Cannot access /opt/luxlabs, using $INSTALL_DIR instead"
  else
    echo "   ✗ Error: Cannot create install directory"
    echo "   Please run: sudo mkdir -p /opt/luxlabs/dashboard && sudo chown $USER:$USER /opt/luxlabs/dashboard"
    exit 1
  fi
else
  echo "[1/8] Install directory exists: $INSTALL_DIR"
fi

# Copy files
echo "[2/8] Copying files to $INSTALL_DIR..."
cp -r server.js package.json public "$INSTALL_DIR/"

# Install dependencies
echo "[3/8] Installing dependencies..."
cd "$INSTALL_DIR"
npm install --omit=dev

# Auto-detect DATABASE_URL
echo "[4/8] Detecting DATABASE_URL..."
DATABASE_URL=""

# Try direct DATABASE_URL from ChefsBook .env.local
if [ -f "/opt/luxlabs/chefsbook/repo/.env.local" ]; then
  DB_FROM_FILE=$(grep "^DATABASE_URL=" /opt/luxlabs/chefsbook/repo/.env.local | cut -d'=' -f2-)
  if [ -n "$DB_FROM_FILE" ]; then
    DATABASE_URL="$DB_FROM_FILE"
    echo "   Found DATABASE_URL in .env.local"
  fi
fi

# If not found, try constructing from POSTGRES_PASSWORD
if [ -z "$DATABASE_URL" ] && [ -f "/opt/luxlabs/chefsbook/repo/.env.local" ]; then
  PG_PASSWORD=$(grep "^POSTGRES_PASSWORD=" /opt/luxlabs/chefsbook/repo/.env.local | cut -d'=' -f2-)
  if [ -n "$PG_PASSWORD" ]; then
    DATABASE_URL="postgresql://supabase_admin:$PG_PASSWORD@localhost:5432/postgres"
    echo "   Constructed DATABASE_URL from POSTGRES_PASSWORD"
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "   ⚠ DATABASE_URL not found - Supabase panels will show setup instructions"
  echo "   To enable later, set DATABASE_URL env var and restart PM2 process"
fi

# Stop existing PM2 process
echo "[5/8] Stopping existing PM2 process (if any)..."
pm2 delete "$PM2_NAME" 2>/dev/null || true

# Start with PM2
echo "[6/8] Starting dashboard with PM2..."
if [ -n "$DATABASE_URL" ]; then
  DATABASE_URL="$DATABASE_URL" pm2 start server.js --name "$PM2_NAME" --cwd "$INSTALL_DIR"
else
  pm2 start server.js --name "$PM2_NAME" --cwd "$INSTALL_DIR"
fi

# Save PM2 config
echo "[7/8] Saving PM2 configuration..."
pm2 save

# Get network addresses
echo "[8/8] Detecting network addresses..."
LAN_IP=$(ip -4 addr show | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | grep -v '127.0.0.1' | head -1)
TS_IP=$(tailscale ip -4 2>/dev/null || echo "not available")

echo ""
echo "=========================================="
echo "✓ LuxLabs Dashboard installed successfully!"
echo "=========================================="
echo ""
echo "Access dashboard at:"
echo "  • Localhost:    http://localhost:$PORT"
echo "  • LAN:          http://$LAN_IP:$PORT"
echo "  • Tailscale:    http://$TS_IP:$PORT"
echo ""
echo "PM2 status:"
pm2 info "$PM2_NAME" | grep -E "status|memory|restarts"
echo ""
echo "To view logs: pm2 logs $PM2_NAME"
echo "To restart:   pm2 restart $PM2_NAME"
echo "To stop:      pm2 stop $PM2_NAME"
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "⚠ Note: DATABASE_URL not configured"
  echo "   Supabase and Live panels will show limited data"
  echo "   To enable: set DATABASE_URL env var and restart"
  echo ""
fi

echo "For kiosk display setup, run: sudo ./display-setup.sh --kiosk"
echo "For TTY-only setup, run: sudo ./display-setup.sh --tty-only"
