#!/bin/bash
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

MODE="${1:---kiosk}"

echo "=========================================="
echo "LuxLabs Display Setup ($MODE)"
echo "=========================================="

if [ "$MODE" == "--kiosk" ]; then
  echo "[1/5] Installing X11 and Chromium packages..."
  apt-get update
  apt-get install -y xorg chromium-browser unclutter x11-xserver-utils

  echo "[2/5] Creating kiosk launcher script..."
  cat > /usr/local/bin/luxlabs-kiosk.sh <<'EOF'
#!/bin/bash
export DISPLAY=:0

# Start X server
xinit /usr/bin/chromium-browser --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble http://localhost:9000 -- :0 &

# Wait for X to start
sleep 3

# Configure DPMS (Display Power Management)
xset dpms 180 180 300  # standby 180s, suspend 180s, off 300s
xset s 180 180         # screen saver after 180s

# Hide cursor after 3s of inactivity
unclutter -idle 3 &

# Keep script running
wait
EOF

  chmod +x /usr/local/bin/luxlabs-kiosk.sh

  echo "[3/5] Creating systemd service..."
  cat > /etc/systemd/system/luxlabs-kiosk.service <<EOF
[Unit]
Description=LuxLabs Dashboard Kiosk Mode
After=luxlabs-dashboard.service network.target
Wants=luxlabs-dashboard.service

[Service]
Type=simple
User=luxlabs
ExecStart=/usr/local/bin/luxlabs-kiosk.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  echo "[4/5] Enabling and starting service..."
  systemctl daemon-reload
  systemctl enable luxlabs-kiosk.service

  echo "[5/5] Service created (not started yet)"
  echo ""
  echo "=========================================="
  echo "✓ Kiosk mode configured!"
  echo "=========================================="
  echo ""
  echo "To start kiosk now:     sudo systemctl start luxlabs-kiosk"
  echo "To check status:        sudo systemctl status luxlabs-kiosk"
  echo "To view logs:           sudo journalctl -u luxlabs-kiosk -f"
  echo ""
  echo "The dashboard will auto-start on boot in fullscreen kiosk mode."

elif [ "$MODE" == "--tty-only" ]; then
  echo "[1/3] Configuring framebuffer blanking..."

  echo "[2/3] Creating systemd service for blanking..."
  cat > /etc/systemd/system/luxlabs-blanking.service <<EOF
[Unit]
Description=LuxLabs TTY Blanking Configuration
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'setterm -blank 5 -powerdown 10 > /dev/tty1'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

  echo "[3/3] Enabling blanking service..."
  systemctl daemon-reload
  systemctl enable luxlabs-blanking.service
  systemctl start luxlabs-blanking.service

  echo ""
  echo "=========================================="
  echo "✓ TTY blanking configured!"
  echo "=========================================="
  echo ""
  echo "Screen will blank after 5 minutes of inactivity"
  echo "Power down after 10 minutes"
  echo ""
  echo "To access dashboard, open browser to:"
  echo "  http://localhost:9000"

else
  echo "Error: Invalid mode '$MODE'"
  echo "Usage: $0 [--kiosk|--tty-only]"
  exit 1
fi
