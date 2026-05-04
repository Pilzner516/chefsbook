#!/bin/bash
# ChefsBook slux Setup Verification Script
# Run this from dev machine: ssh Pilzner@slux "bash -s" < verify-slux-setup.sh

echo "=== ChefsBook slux Setup Verification ==="
echo ""

PASS=0
FAIL=0

# Helper function
check() {
    local test_name="$1"
    local command="$2"

    echo -n "Checking: $test_name... "
    if eval "$command" &>/dev/null; then
        echo "✓ PASS"
        ((PASS++))
    else
        echo "✗ FAIL"
        ((FAIL++))
    fi
}

# US-001: Docker and Dev Tools
echo "[US-001] Docker Group & Dev Tools"
check "Pilzner in docker group" "groups | grep -q docker"
check "docker works without sudo" "docker ps"
check "git installed" "git --version"
check "postgresql-client installed" "psql --version"
echo ""

# US-002: Directory Structure
echo "[US-002] Directory Structure"
check "/opt/luxlabs/chefsbook/repo exists" "[ -d /opt/luxlabs/chefsbook/repo ]"
check "/opt/luxlabs/chefsbook/supabase exists" "[ -d /opt/luxlabs/chefsbook/supabase ]"
check "/opt/luxlabs/chefsbook/data exists" "[ -d /opt/luxlabs/chefsbook/data ]"
check "/opt/luxlabs/chefsbook/backups exists" "[ -d /opt/luxlabs/chefsbook/backups ]"
check "Pilzner has write access to repo" "[ -w /opt/luxlabs/chefsbook/repo ]"
echo ""

# US-003: SSH Key (if this script runs, SSH is working)
echo "[US-003] SSH Key Authentication"
check "SSH connection works" "true"  # If we're here, it worked
check "~/.ssh/authorized_keys exists" "[ -f ~/.ssh/authorized_keys ]"
check "~/.ssh permissions correct" "[ $(stat -c %a ~/.ssh) = '700' ]"
check "authorized_keys permissions correct" "[ $(stat -c %a ~/.ssh/authorized_keys) = '600' ]"
echo ""

# US-004: Static IP
echo "[US-004] Static IP Configuration"
check "Static IP 192.168.1.236 assigned" "ip addr show | grep -q '192.168.1.236'"
check "Netplan config exists" "[ -f /etc/netplan/01-netcfg.yaml ]"
check "IP is pingable" "ping -c 1 192.168.1.236"
echo ""

# US-005: Repository Clone
echo "[US-005] Repository Clone"
check "Git repo exists" "[ -d /opt/luxlabs/chefsbook/repo/.git ]"
check "Git remote configured" "cd /opt/luxlabs/chefsbook/repo && git remote -v | grep -q origin"
check "On a git branch" "cd /opt/luxlabs/chefsbook/repo && git branch --show-current | grep -qE '.+'"
check "Commit history exists" "cd /opt/luxlabs/chefsbook/repo && git log -1"
echo ""

# US-006: Supabase Configuration
echo "[US-006] Supabase Configuration"
check "docker-compose.yml exists" "[ -f /opt/luxlabs/chefsbook/supabase/docker-compose.yml ]"
check ".env.local exists" "[ -f /opt/luxlabs/chefsbook/repo/.env.local ]"
check ".env.local has SUPABASE_URL" "grep -q 'SUPABASE_URL' /opt/luxlabs/chefsbook/repo/.env.local"
check ".env.local permissions secure" "[ $(stat -c %a /opt/luxlabs/chefsbook/repo/.env.local) = '600' ]"
echo ""

# US-007: Supabase Stack
echo "[US-007] Supabase Docker Stack"
check "supabase-db running" "docker ps --format '{{.Names}}' | grep -q supabase-db"
check "supabase-auth running" "docker ps --format '{{.Names}}' | grep -q supabase-auth"
check "supabase-rest running" "docker ps --format '{{.Names}}' | grep -q supabase-rest"
check "supabase-storage running" "docker ps --format '{{.Names}}' | grep -q supabase-storage"
check "supabase-kong running" "docker ps --format '{{.Names}}' | grep -q supabase-kong"
check "No exited containers" "! docker ps -a --filter 'status=exited' --format '{{.Names}}' | grep -q supabase"
echo ""

# US-008: Node Dependencies
echo "[US-008] Node Dependencies"
check "node_modules exists" "[ -d /opt/luxlabs/chefsbook/repo/node_modules ]"
check "package.json exists" "[ -f /opt/luxlabs/chefsbook/repo/package.json ]"
check "Dependencies installed" "[ -f /opt/luxlabs/chefsbook/repo/node_modules/.package-lock.json ] || [ -f /opt/luxlabs/chefsbook/repo/package-lock.json ]"
echo ""

# Summary
echo "=== Verification Summary ==="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ All checks passed! Setup is complete."
    exit 0
else
    echo "✗ Some checks failed. Review output above."
    exit 1
fi
