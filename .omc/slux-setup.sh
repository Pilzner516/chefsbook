#!/bin/bash
# ChefsBook Infrastructure Setup Script for slux
# Run this script on slux as root or with sudo

set -e  # Exit on error
set -u  # Exit on undefined variable

echo "=== ChefsBook slux Setup Script ==="
echo "Starting infrastructure setup..."
echo ""

# US-001: Docker group and dev tools
echo "[1/8] Adding Pilzner to docker group and installing dev tools..."
usermod -aG docker Pilzner
apt-get update
apt-get install -y git postgresql-client
echo "✓ Docker group membership added"
echo "✓ git and postgresql-client installed"
echo ""

# US-002: Directory structure
echo "[2/8] Creating /opt/luxlabs/chefsbook/ directory structure..."
mkdir -p /opt/luxlabs/chefsbook/{repo,supabase,data,backups}
chown -R Pilzner:Pilzner /opt/luxlabs/chefsbook
chmod -R 755 /opt/luxlabs/chefsbook
echo "✓ Directory structure created with proper permissions"
echo ""

# US-003: SSH key setup instructions (manual step required)
echo "[3/8] SSH key authentication setup..."
echo "MANUAL STEP REQUIRED:"
echo "  1. On dev machine, run: cat ~/.ssh/id_ed25519.pub"
echo "  2. Copy the output"
echo "  3. On slux, run as Pilzner: mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "  4. Append the key to: echo '<paste-key-here>' >> ~/.ssh/authorized_keys"
echo "  5. Set permissions: chmod 600 ~/.ssh/authorized_keys"
echo ""
read -p "Press Enter after completing SSH key setup..."
echo "✓ SSH key setup (manual step)"
echo ""

# US-004: Static IP via netplan
echo "[4/8] Configuring static IP 192.168.1.236..."
cat > /etc/netplan/01-netcfg.yaml <<'NETPLAN'
network:
  version: 2
  renderer: networkd
  ethernets:
    # Replace 'enp0s3' with your actual interface name (check with 'ip link')
    enp0s3:
      dhcp4: no
      addresses:
        - 192.168.1.236/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
NETPLAN

echo "IMPORTANT: Edit /etc/netplan/01-netcfg.yaml to use correct interface name"
echo "Check interface with: ip link"
read -p "Press Enter after editing interface name..."

netplan apply
echo "✓ Static IP configured and applied"
echo ""

# US-005: Clone repository
echo "[5/8] Cloning ChefsBook repository..."
su - Pilzner -c "cd /opt/luxlabs/chefsbook && git clone https://github.com/Pilzner516/chefsbook.git repo"
echo "✓ Repository cloned"
echo ""

# US-006: Copy Supabase config from rpi5
echo "[6/8] Copying Supabase configuration from rpi5-eth..."
echo "MANUAL STEP REQUIRED:"
echo "  Run from dev machine:"
echo "  scp rasp@rpi5-eth:/mnt/chefsbook/supabase/docker-compose.yml /tmp/"
echo "  scp rasp@rpi5-eth:/mnt/chefsbook/repo/.env.local /tmp/"
echo "  scp /tmp/docker-compose.yml Pilzner@slux:/opt/luxlabs/chefsbook/supabase/"
echo "  scp /tmp/.env.local Pilzner@slux:/opt/luxlabs/chefsbook/repo/"
echo ""
read -p "Press Enter after copying config files..."
echo "✓ Configuration files copied"
echo ""

# US-007: Start Supabase stack
echo "[7/8] Starting Supabase Docker stack..."
cd /opt/luxlabs/chefsbook/supabase
docker compose up -d
echo "Waiting for containers to start..."
sleep 10
docker compose ps
echo "✓ Supabase stack started"
echo ""

# US-008: Verify Node dependencies
echo "[8/8] Verifying Node.js dependencies..."
su - Pilzner -c "cd /opt/luxlabs/chefsbook/repo && npm install"
echo "✓ Node dependencies installed"
echo ""

echo "=== Setup Complete ==="
echo ""
echo "Verification steps:"
echo "1. Check docker group: groups Pilzner | grep docker"
echo "2. Test SSH: ssh Pilzner@slux (from dev machine)"
echo "3. Check IP: ip addr show | grep 192.168.1.236"
echo "4. Check containers: docker ps"
echo "5. Check repo: ls -la /opt/luxlabs/chefsbook/repo"
