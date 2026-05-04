#!/bin/bash
# Run this on slux with sudo: sudo bash slux-sudo-tasks.sh
# Completes all tasks that require root privileges

set -e
echo "=== ChefsBook slux Setup - Sudo Tasks ==="
echo ""

# US-001: Add pilzner to docker group
echo "[1/5] Adding pilzner to docker group..."
usermod -aG docker pilzner
echo "✓ pilzner added to docker group"
echo ""

# US-001: Install postgresql-client (git already installed)
echo "[2/5] Installing postgresql-client..."
apt-get update -qq
apt-get install -y postgresql-client
echo "✓ postgresql-client installed"
echo ""

# US-002: Create directory structure
echo "[3/5] Creating /opt/luxlabs/chefsbook/ structure..."
mkdir -p /opt/luxlabs/chefsbook/{repo,supabase,data,backups}
chown -R pilzner:pilzner /opt/luxlabs/chefsbook
chmod -R 755 /opt/luxlabs/chefsbook
echo "✓ Directory structure created with pilzner ownership"
echo ""

# US-004: Configure static IP via netplan
echo "[4/5] Configuring static IP 192.168.1.236..."
INTERFACE=$(ip -4 addr show | grep '192.168.1.236' | awk '{print $NF}')
echo "Detected interface: $INTERFACE"

cat > /etc/netplan/01-static-ip.yaml <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    $INTERFACE:
      dhcp4: no
      addresses:
        - 192.168.1.236/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
EOF

echo "✓ Netplan config created at /etc/netplan/01-static-ip.yaml"
netplan apply
echo "✓ Static IP configuration applied"
echo ""

# Verification
echo "[5/5] Verification..."
echo "Docker group membership:"
groups pilzner | grep docker && echo "✓ PASS" || echo "✗ FAIL"

echo "Installed tools:"
git --version && echo "✓ git installed"
psql --version && echo "✓ postgresql-client installed"

echo "Directory ownership:"
ls -la /opt/luxlabs/chefsbook/ && echo "✓ Directories exist with correct ownership"

echo "Static IP:"
ip addr show $INTERFACE | grep 192.168.1.236 && echo "✓ IP configured"

echo ""
echo "=== Sudo Tasks Complete ==="
echo ""
echo "IMPORTANT: pilzner must log out and back in for docker group to take effect"
echo "Or run: newgrp docker"
