#!/bin/bash
# Dashboard Foundation Setup Script for luxlabs-pc
# Run this script directly on luxlabs-pc as pilzner user
# Usage: bash /path/to/luxlabs-dashboard-setup.sh

set -e

echo "=== Dashboard Foundation Setup for luxlabs-pc ==="
echo ""

# 1. Install required packages
echo "[1/5] Installing required packages..."
sudo apt-get update
sudo apt-get install -y lm-sensors vnstat net-tools

echo ""
echo "[2/5] Configuring GRUB console blanking..."

# Back up GRUB config
if [ ! -f /etc/default/grub.bak ]; then
    sudo cp /etc/default/grub /etc/default/grub.bak
    echo "  - Backed up /etc/default/grub to /etc/default/grub.bak"
fi

# Add consoleblank=300 to GRUB_CMDLINE_LINUX_DEFAULT if not already present
if ! grep -q "consoleblank=300" /etc/default/grub; then
    sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 consoleblank=300"/' /etc/default/grub
    echo "  - Added consoleblank=300 to GRUB_CMDLINE_LINUX_DEFAULT"
    sudo update-grub
    echo "  - Ran update-grub"
else
    echo "  - consoleblank=300 already present in GRUB config"
fi

echo ""
echo "[3/5] Creating systemd console power management service..."

# Create console-power.service
sudo mkdir -p /etc/systemd/system
sudo tee /etc/systemd/system/console-power.service > /dev/null <<'EOF'
[Unit]
Description=Console Power Management (blank at 5 min, powerdown at 10 min)
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/usr/bin/setterm -blank 5 -powerdown 10 -term linux >/dev/tty1
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

echo "  - Created /etc/systemd/system/console-power.service"

sudo systemctl daemon-reload
sudo systemctl enable console-power.service
echo "  - Enabled console-power.service"

echo ""
echo "[4/5] Masking sleep/suspend/hibernate targets..."

sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
echo "  - Masked sleep.target suspend.target hibernate.target hybrid-sleep.target"

echo ""
echo "[5/5] Configuring getty@tty1 auto-login for pilzner..."

# Create getty override directory
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d

# Create override.conf
sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf > /dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pilzner --noclear %I $TERM
EOF

echo "  - Created /etc/systemd/system/getty@tty1.service.d/override.conf"

sudo systemctl daemon-reload
echo "  - Ran systemctl daemon-reload"

echo ""
echo "=== Creating rollback script ==="

# Create rollback script
sudo mkdir -p /opt/luxlabs
sudo tee /opt/luxlabs/dashboard-rollback.sh > /dev/null <<'EOF'
#!/bin/bash
# Dashboard Rollback Script
# Reverts all changes made by luxlabs-dashboard-setup.sh
# Run as: sudo bash /opt/luxlabs/dashboard-rollback.sh

set -e

echo "=== Rolling back Dashboard Foundation changes ==="
echo ""

# 1. Restore GRUB config
if [ -f /etc/default/grub.bak ]; then
    echo "[1/5] Restoring GRUB config..."
    cp /etc/default/grub.bak /etc/default/grub
    update-grub
    echo "  - Restored /etc/default/grub from backup"
else
    echo "[1/5] No GRUB backup found, skipping"
fi

# 2. Disable and remove console-power.service
echo "[2/5] Disabling console-power.service..."
systemctl disable console-power.service 2>/dev/null || true
rm -f /etc/systemd/system/console-power.service
echo "  - Disabled and removed console-power.service"

# 3. Remove getty override
echo "[3/5] Removing getty@tty1 auto-login override..."
rm -rf /etc/systemd/system/getty@tty1.service.d
echo "  - Removed /etc/systemd/system/getty@tty1.service.d/override.conf"

# 4. Unmask sleep targets
echo "[4/5] Unmasking sleep/suspend/hibernate targets..."
systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target
echo "  - Unmasked sleep.target suspend.target hibernate.target hybrid-sleep.target"

# 5. Reload systemd
echo "[5/5] Reloading systemd daemon..."
systemctl daemon-reload
echo "  - Ran systemctl daemon-reload"

echo ""
echo "=== Rollback complete ==="
echo ""
echo "IMPORTANT: Reboot required for all changes to take effect."
echo "After reboot, TTY1 will require manual login and use default power settings."
echo ""
EOF

sudo chmod +x /opt/luxlabs/dashboard-rollback.sh
echo "  - Created /opt/luxlabs/dashboard-rollback.sh"
echo "  - Made rollback script executable"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Summary of changes:"
echo "  - Installed: lm-sensors, vnstat, net-tools"
echo "  - GRUB: Added consoleblank=300 (backed up to /etc/default/grub.bak)"
echo "  - Created console-power.service (5 min blank, 10 min powerdown)"
echo "  - Masked sleep/suspend/hibernate targets"
echo "  - Configured getty@tty1 for auto-login as pilzner"
echo "  - Created rollback script at /opt/luxlabs/dashboard-rollback.sh"
echo ""
echo "IMPORTANT: Changes require a REBOOT to take effect."
echo "DO NOT REBOOT YET — Agent 4 will handle final testing."
echo ""
echo "To rollback all changes: sudo bash /opt/luxlabs/dashboard-rollback.sh"
echo ""
