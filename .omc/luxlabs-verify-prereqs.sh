#!/bin/bash
# Pre-setup verification script for luxlabs-pc
# Checks current state before running dashboard setup

echo "=== Pre-Setup Verification for luxlabs-pc ==="
echo ""

# Check installed packages
echo "[1] Package status:"
for pkg in btop tmux lm-sensors vnstat jq bc net-tools curl; do
    if dpkg -l | grep -q "^ii  $pkg "; then
        echo "  ✓ $pkg installed"
    else
        echo "  ✗ $pkg NOT installed"
    fi
done

echo ""
echo "[2] GRUB config status:"
if grep -q "consoleblank=" /etc/default/grub; then
    echo "  Current consoleblank setting: $(grep consoleblank /etc/default/grub | head -1)"
else
    echo "  No consoleblank setting found"
fi

if [ -f /etc/default/grub.bak ]; then
    echo "  ⚠ Backup already exists: /etc/default/grub.bak"
fi

echo ""
echo "[3] Systemd service status:"
if [ -f /etc/systemd/system/console-power.service ]; then
    echo "  ⚠ console-power.service already exists"
    systemctl is-enabled console-power.service 2>/dev/null && echo "    Status: enabled" || echo "    Status: disabled"
else
    echo "  ✓ console-power.service does NOT exist (clean slate)"
fi

echo ""
echo "[4] Sleep/suspend target status:"
for target in sleep suspend hibernate hybrid-sleep; do
    if systemctl is-masked ${target}.target 2>/dev/null | grep -q masked; then
        echo "  ⚠ ${target}.target already masked"
    else
        echo "  ✓ ${target}.target NOT masked"
    fi
done

echo ""
echo "[5] Getty auto-login status:"
if [ -f /etc/systemd/system/getty@tty1.service.d/override.conf ]; then
    echo "  ⚠ Getty override already exists"
    cat /etc/systemd/system/getty@tty1.service.d/override.conf
else
    echo "  ✓ No getty override (clean slate)"
fi

echo ""
echo "[6] Rollback script status:"
if [ -f /opt/luxlabs/dashboard-rollback.sh ]; then
    echo "  ⚠ Rollback script already exists at /opt/luxlabs/dashboard-rollback.sh"
else
    echo "  ✓ No rollback script yet"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
