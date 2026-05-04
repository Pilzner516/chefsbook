# Dashboard Foundation Setup - luxlabs-pc

## Status: Ready for Execution

Two scripts have been transferred to luxlabs-pc at `/tmp/`:

1. **luxlabs-verify-prereqs.sh** - Pre-setup verification
2. **luxlabs-dashboard-setup.sh** - Main setup script

## Execution Steps

### Step 1: Verify Current State (Optional)

SSH into luxlabs-pc and run the verification script:

```bash
ssh pilzner@100.83.66.51
bash /tmp/luxlabs-verify-prereqs.sh
```

This will show what's already installed/configured.

### Step 2: Run Setup Script

Execute the main setup script on luxlabs-pc:

```bash
bash /tmp/luxlabs-dashboard-setup.sh
```

You will be prompted for your sudo password during execution.

## What the Setup Script Does

### 1. Package Installation
Installs missing packages:
- `lm-sensors` - Hardware sensor monitoring
- `vnstat` - Network traffic monitoring
- `net-tools` - Network utilities (ifconfig, netstat)

Already installed (verified):
- `btop` - System monitor
- `tmux` - Terminal multiplexer
- `jq` - JSON processor
- `bc` - Calculator
- `curl` - HTTP client

### 2. GRUB Console Blanking
- Backs up `/etc/default/grub` to `/etc/default/grub.bak`
- Adds `consoleblank=300` to `GRUB_CMDLINE_LINUX_DEFAULT`
- Runs `update-grub` to apply changes
- **Effect:** Console blanks after 5 minutes of inactivity

### 3. Console Power Management Service
Creates `/etc/systemd/system/console-power.service`:
- Blanks screen after 5 minutes
- Powers down display after 10 minutes
- Runs at boot via systemd
- Service is enabled automatically

### 4. Disable Sleep/Suspend/Hibernate
Masks systemd targets:
- `sleep.target`
- `suspend.target`
- `hibernate.target`
- `hybrid-sleep.target`

**Effect:** Prevents accidental system sleep/suspend.

### 5. TTY1 Auto-Login
Creates `/etc/systemd/system/getty@tty1.service.d/override.conf`:
- Auto-login as `pilzner` user on TTY1
- No password prompt on console boot
- **Security note:** SSH login still requires password

### 6. Rollback Script
Creates `/opt/luxlabs/dashboard-rollback.sh`:
- Reverses all setup changes
- Restores original GRUB config
- Removes services and overrides
- Unmasks sleep targets
- **Usage:** `sudo bash /opt/luxlabs/dashboard-rollback.sh`

## After Setup

**DO NOT REBOOT YET** - Agent 4 will handle final testing and reboot.

The script will report:
- Which packages were installed
- Whether GRUB was updated
- Service creation status
- Path to rollback script

## Rollback Procedure

If you need to undo all changes:

```bash
sudo bash /opt/luxlabs/dashboard-rollback.sh
sudo reboot
```

## Files Modified/Created

### Modified (with backups):
- `/etc/default/grub` (backup: `/etc/default/grub.bak`)

### Created:
- `/etc/systemd/system/console-power.service`
- `/etc/systemd/system/getty@tty1.service.d/override.conf`
- `/opt/luxlabs/dashboard-rollback.sh`

### Masked:
- `sleep.target`
- `suspend.target`
- `hibernate.target`
- `hybrid-sleep.target`

## Verification Commands

After setup completes, verify with:

```bash
# Check service status
systemctl status console-power.service

# Check getty override
systemctl cat getty@tty1.service

# Check masked targets
systemctl is-masked sleep.target suspend.target hibernate.target hybrid-sleep.target

# Check GRUB config
grep consoleblank /etc/default/grub

# Check installed packages
dpkg -l | grep -E 'lm-sensors|vnstat|net-tools'
```

## Expected Output

Setup script should complete with:

```
=== Setup Complete ===

Summary of changes:
  - Installed: lm-sensors, vnstat, net-tools
  - GRUB: Added consoleblank=300 (backed up to /etc/default/grub.bak)
  - Created console-power.service (5 min blank, 10 min powerdown)
  - Masked sleep/suspend/hibernate targets
  - Configured getty@tty1 for auto-login as pilzner
  - Created rollback script at /opt/luxlabs/dashboard-rollback.sh

IMPORTANT: Changes require a REBOOT to take effect.
DO NOT REBOOT YET — Agent 4 will handle final testing.

To rollback all changes: sudo bash /opt/luxlabs/dashboard-rollback.sh
```

## Critical Notes

1. **SSH Access:** NOT affected by these changes - SSH login remains normal
2. **Reboot Required:** GRUB and getty changes need reboot to take effect
3. **Console Blanking:** Takes effect after reboot (kernel parameter)
4. **Service Start:** console-power.service runs once at boot
5. **Auto-login:** Only affects TTY1 physical console, not SSH

## Troubleshooting

If setup fails:

1. Check script output for specific error
2. Verify sudo privileges: `sudo -v`
3. Check disk space: `df -h /`
4. Check systemd status: `systemctl status`
5. Run rollback if needed: `sudo bash /opt/luxlabs/dashboard-rollback.sh`

## Next Steps

After successful setup:
- Agent 4 will perform final testing
- Agent 4 will handle the reboot
- TTY1 will auto-login to pilzner after reboot
- Console will blank/powerdown at 5/10 minutes
