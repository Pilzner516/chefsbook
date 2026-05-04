# ChefsBook slux Infrastructure Setup Instructions

## Current Blocker
Cannot SSH into slux as Pilzner - authentication failing. Setup requires manual execution on slux.

## Prerequisites
- Physical/console access to slux server
- Root/sudo access on slux
- SSH access to rpi5-eth from dev machine: `ssh rasp@rpi5-eth`

## Setup Method

### Option A: Run Automated Script on slux
1. Copy the setup script to slux:
   ```bash
   # From dev machine (if you have access to another user on slux):
   scp .omc/slux-setup.sh <your-user>@slux:/tmp/
   
   # Then on slux:
   sudo bash /tmp/slux-setup.sh
   ```

### Option B: Manual Step-by-Step Execution

#### Step 1: Docker Group & Dev Tools (US-001)
```bash
# On slux as root or with sudo:
sudo usermod -aG docker Pilzner
sudo apt-get update
sudo apt-get install -y git postgresql-client

# Verify:
groups Pilzner | grep docker
git --version
psql --version
```

#### Step 2: Directory Structure (US-002)
```bash
# On slux as root:
sudo mkdir -p /opt/luxlabs/chefsbook/{repo,supabase,data,backups}
sudo chown -R Pilzner:Pilzner /opt/luxlabs/chefsbook
sudo chmod -R 755 /opt/luxlabs/chefsbook

# Verify:
ls -la /opt/luxlabs/chefsbook/
```

#### Step 3: SSH Key Authentication (US-003)
```bash
# On dev machine, get your public key:
cat ~/.ssh/id_ed25519.pub

# Copy the output, then on slux as Pilzner:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '<paste-the-key-here>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Verify from dev machine:
ssh Pilzner@slux "echo 'SSH works!'"
```

#### Step 4: Static IP Configuration (US-004)
```bash
# On slux, first check interface name:
ip link

# Create netplan config (replace enp0s3 with your interface):
sudo tee /etc/netplan/01-netcfg.yaml <<'EOF'
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:  # REPLACE with your interface name
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

# Apply netplan:
sudo netplan apply

# Verify:
ip addr show | grep 192.168.1.236
ping -c 3 192.168.1.236
```

#### Step 5: Clone Repository (US-005)
```bash
# On slux as Pilzner (or: sudo su - Pilzner):
cd /opt/luxlabs/chefsbook
git clone <your-repo-url> repo

# If private repo, set up git credentials first

# Verify:
ls -la /opt/luxlabs/chefsbook/repo/
cd /opt/luxlabs/chefsbook/repo && git log -1
```

#### Step 6: Copy Supabase Config (US-006)
```bash
# From dev machine, copy files from rpi5:
scp rasp@rpi5-eth:/mnt/chefsbook/supabase/docker-compose.yml /tmp/supabase-compose.yml
scp rasp@rpi5-eth:/mnt/chefsbook/repo/.env.local /tmp/chefsbook-env

# Then copy to slux (after SSH key is set up):
scp /tmp/supabase-compose.yml Pilzner@slux:/opt/luxlabs/chefsbook/supabase/docker-compose.yml
scp /tmp/chefsbook-env Pilzner@slux:/opt/luxlabs/chefsbook/repo/.env.local

# Set permissions on slux:
chmod 600 /opt/luxlabs/chefsbook/repo/.env.local

# Verify:
ls -la /opt/luxlabs/chefsbook/supabase/docker-compose.yml
ls -la /opt/luxlabs/chefsbook/repo/.env.local
```

#### Step 7: Start Supabase Stack (US-007)
```bash
# On slux as Pilzner:
cd /opt/luxlabs/chefsbook/supabase
docker compose up -d

# Wait and verify:
sleep 15
docker compose ps

# Check logs:
docker compose logs --tail=50

# Expected containers:
# - supabase-db
# - supabase-auth
# - supabase-rest
# - supabase-storage
# - supabase-kong
# - supabase-realtime
# - supabase-studio
```

#### Step 8: Verify Node Dependencies (US-008)
```bash
# On slux as Pilzner:
cd /opt/luxlabs/chefsbook/repo
npm install

# Verify:
ls -la node_modules/
npm run --list

# Test TypeScript compilation:
cd apps/web && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit
```

## Verification Checklist

After completing all steps, run from dev machine:
```bash
ssh Pilzner@slux "bash -s" < .omc/verify-slux-setup.sh
```

Or verify manually:
- [ ] Pilzner is in docker group
- [ ] git and postgresql-client installed
- [ ] /opt/luxlabs/chefsbook structure exists
- [ ] SSH key auth works (no password prompt)
- [ ] Static IP 192.168.1.236 is active
- [ ] Repository cloned successfully
- [ ] Supabase config files in place
- [ ] All Supabase containers running
- [ ] Node dependencies installed

## Next Steps After Setup
1. Update Tailscale configuration if needed
2. Migrate database from rpi5 to slux
3. Update Cloudflare tunnel to point to slux
4. Test web app on slux:3000
5. Cut over production traffic
