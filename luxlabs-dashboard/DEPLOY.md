# LuxLabs Dashboard Deployment Guide

## Prerequisites

- Target server: `luxlabs-pc` (Ubuntu Server 24.04)
- SSH access: `luxlabs@luxlabs-pc` or via Tailscale
- PM2 installed globally on target server
- Node.js v18+ installed on target server

## Quick Deploy (Copy-Paste Commands)

### 1. From your development machine, upload the tarball:

```bash
# Navigate to the directory containing luxlabs-dashboard.tar.gz
cd /path/to/luxlabs-dashboard

# Upload to luxlabs-pc
scp luxlabs-dashboard.tar.gz luxlabs@luxlabs-pc:/tmp/
```

### 2. SSH into luxlabs-pc and extract:

```bash
ssh luxlabs@luxlabs-pc

# Extract tarball
cd /tmp
tar -xzf luxlabs-dashboard.tar.gz
cd luxlabs-dashboard

# Make scripts executable
chmod +x setup.sh display-setup.sh
```

### 3. Run the setup script:

```bash
# This will:
# - Create /opt/luxlabs/dashboard/ directory
# - Install npm dependencies
# - Auto-detect DATABASE_URL from ChefsBook .env.local
# - Start the dashboard with PM2
# - Save PM2 config for auto-restart on reboot

./setup.sh
```

The setup script will output access URLs when complete.

### 4. Verify the dashboard is running:

```bash
pm2 status
# Should show "luxlabs-dashboard" with status "online"

pm2 logs luxlabs-dashboard
# Should show "[SERVER] LuxLabs Dashboard running on http://0.0.0.0:9000"

# Test HTTP endpoint
curl http://localhost:9000/api/system
# Should return JSON with cpu, ram, load, etc.
```

### 5. Access the dashboard:

Open a browser to:
- **Localhost** (on luxlabs-pc): http://localhost:9000
- **LAN**: http://<lan-ip>:9000
- **Tailscale**: http://<tailscale-ip>:9000

You should see the 3×3 grid dashboard with all panels loading data.

## Optional: Display Setup

### For Dedicated Monitor (Kiosk Mode)

If luxlabs-pc is connected to a dedicated monitor for 24/7 display:

```bash
cd /tmp/luxlabs-dashboard
sudo ./display-setup.sh --kiosk

# This will:
# - Install X11, Chromium, unclutter
# - Create kiosk launcher script
# - Create systemd service for auto-start on boot
# - Configure DPMS power management (standby 180s, off 300s)
# - Hide cursor after 3s inactivity

# Start kiosk now:
sudo systemctl start luxlabs-kiosk

# Check status:
sudo systemctl status luxlabs-kiosk
```

The dashboard will now run fullscreen in kiosk mode and auto-start on boot.

### For Headless Server (TTY-Only Mode)

If luxlabs-pc has no monitor attached:

```bash
cd /tmp/luxlabs-dashboard
sudo ./display-setup.sh --tty-only

# This will configure TTY blanking only
```

Access the dashboard from any device on the network via browser.

## Updating the Dashboard

To update after code changes:

```bash
# 1. From dev machine, upload new tarball
scp luxlabs-dashboard.tar.gz luxlabs@luxlabs-pc:/tmp/

# 2. On luxlabs-pc, extract and re-run setup
cd /tmp
tar -xzf luxlabs-dashboard.tar.gz
cd luxlabs-dashboard
chmod +x setup.sh
./setup.sh

# The setup script is idempotent - safe to re-run
# It will stop the old PM2 process and start the new one
```

## Troubleshooting

### Dashboard not accessible from LAN

Check firewall:
```bash
sudo ufw status
sudo ufw allow 9000/tcp
```

### DATABASE_URL not detected

Manually set the environment variable:
```bash
# Edit PM2 ecosystem (optional)
pm2 delete luxlabs-dashboard
DATABASE_URL="postgresql://user:pass@localhost:5432/postgres" pm2 start /opt/luxlabs/dashboard/server.js --name luxlabs-dashboard
pm2 save
```

Or add to `/opt/luxlabs/dashboard/.env`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/postgres
```

### PM2 process crashes on startup

Check logs:
```bash
pm2 logs luxlabs-dashboard --lines 50
```

Common issues:
- Port 9000 already in use: `sudo lsof -i :9000`
- Missing dependencies: `cd /opt/luxlabs/dashboard && npm install`
- Node.js version: `node --version` (requires v18+)

### Panels showing "?" or empty data

This is normal if DATABASE_URL is not configured. The dashboard will:
- Show system, network, infrastructure data (no DB required)
- Show "?" for live connections and Supabase panels
- Display setup instructions in affected panels

To enable full functionality, ensure DATABASE_URL is set (see above).

## File Structure on Server

After deployment:
```
/opt/luxlabs/dashboard/
├── server.js              # Express backend
├── package.json
├── node_modules/          # Installed dependencies
└── public/
    └── index.html         # Complete dashboard UI
```

PM2 config: `~/.pm2/dump.pm2` (auto-saved)

## Port Reference

- **9000**: Dashboard HTTP server
- **3000**: ChefsBook web (monitored)
- **3001**: ChefsBook staging (monitored)
- **8000**: Supabase Kong (monitored)
- **5432**: PostgreSQL (monitored)

## Support

For issues or questions:
- Check PM2 logs: `pm2 logs luxlabs-dashboard`
- Check system logs: `sudo journalctl -u luxlabs-kiosk -f` (if using kiosk mode)
- Verify endpoints: `curl http://localhost:9000/api/<endpoint>`
