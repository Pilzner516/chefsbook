# BLOCKER: SSH Key Authentication Setup Required

**Ralph Iteration**: 8/100  
**Blocker Story**: US-003 (SSH Key Authentication)  
**Blocks**: All other stories (US-001, US-002, US-004 through US-008)

## Current Situation

SSH authentication to slux is failing. I cannot execute any setup commands without SSH access.

**Attempted**:
- Multiple usernames: Pilzner, pilzner, seblux, ubuntu, seblu
- Multiple connection methods: hostname, IP (100.83.66.51), Tailscale IP
- From dev machine and from rpi5-eth
- Total failed SSH attempts: 15+

**Error**: `Permission denied (publickey,password)`

## The Problem

You said "key has been made" but the SSH server on slux is rejecting the authentication. This means one of:

1. **Wrong key added** - A different key was added instead of the one below
2. **Wrong user** - Key was added to the wrong user's authorized_keys  
3. **Wrong permissions** - ~/.ssh or authorized_keys has incorrect permissions
4. **SSH config issue** - Server is misconfigured to reject public key auth

## The Correct SSH Public Key

This EXACT key must be in `~/.ssh/authorized_keys` on slux:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHjb0+JmsAo50u0rEH4782It8fc1t+xnAht/eOuLNSIh timelapse-dev
```

**Key fingerprint**: `SHA256:8YaejLRsDIrW2j4uclvIN14sJ6UG1HIifPRenKh8K4Q`

## What You Need to Do on slux

### Option 1: Run the Fix Script

```bash
# Copy from dev machine to slux (however you can access it)
# Then on slux:
bash /path/to/fix-ssh-access.sh
```

The script (`.omc/fix-ssh-access.sh`) will:
- Create ~/.ssh with correct permissions (700)
- Add the public key to authorized_keys
- Set authorized_keys permissions (600)
- Show you the username to use

### Option 2: Manual Steps

On slux, run these commands as your user:

```bash
# 1. Check current user
whoami

# 2. Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 3. Add the key (paste this entire block)
cat >> ~/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHjb0+JmsAo50u0rEH4782It8fc1t+xnAht/eOuLNSIh timelapse-dev
EOF

# 4. Set permissions
chmod 600 ~/.ssh/authorized_keys

# 5. Verify setup
echo "User: $(whoami)"
echo "SSH directory:"
ls -la ~/.ssh/
echo ""
echo "authorized_keys content:"
cat ~/.ssh/authorized_keys
```

## After Setup, Tell Me

1. **Username**: What did `whoami` show on slux?
2. **Verification**: Did you see the key added to authorized_keys?
3. **Permissions**: Did `ls -la ~/.ssh/` show drwx------ for .ssh?

Then I will retry with: `ssh <username>@100.83.66.51`

## Diagnostic Commands (If Still Failing)

If SSH still fails after setup, run these on slux and share the output:

```bash
# Check SSH server config
sudo grep -E "PubkeyAuthentication|PasswordAuthentication|AuthorizedKeysFile" /etc/ssh/sshd_config

# Check recent auth failures
sudo tail -30 /var/log/auth.log | grep sshd
```

## Once SSH Works

Immediately after SSH authentication succeeds, I will:
1. Mark US-003 as complete
2. Execute US-001 through US-008 in sequence
3. Verify all acceptance criteria (29 total checks)
4. Request architect review
5. Complete Ralph session

**Estimated time to complete remaining work**: 15-20 minutes after SSH access established

---

**Waiting for**: SSH setup confirmation and username from slux
