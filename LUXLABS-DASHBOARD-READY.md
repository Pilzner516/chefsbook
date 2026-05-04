# luxlabs-pc Trading Terminal Dashboard - Ready to Install

## Current Status

All preparation work is complete! The installation is ready to execute.

### What's Been Prepared

**Agent 1 (System Setup):**
- ✓ Setup script created: `/tmp/luxlabs-dashboard-setup.sh`
- Packages ready to install: lm-sensors, vnstat, net-tools, tmux
- GRUB configuration ready (console blank at 5 min)
- systemd console power management ready
- TTY1 auto-login configuration ready

**Agent 2 (Top Row Scripts):**
- ✓ `/tmp/lb-header.sh` - Status line with date, time, uptime
- ✓ `/tmp/lb-pane1-vitals.sh` - CPU/RAM monitoring
- ✓ `/tmp/lb-pane2-chefsbook.sh` - App health dashboard

**Agent 3 (Bottom Row Scripts):**
- ✓ `~/lb-pane3-network.sh` - Network stats
- ✓ `~/lb-pane4-infra.sh` - Infrastructure status
- ✓ `~/lb-pane5-activity.sh` - Recent activity
- ✓ `~/lb-pane6-alerts.sh` - System alerts

**Agent 4 (Integration - This Agent):**
- ✓ `/tmp/luxlabs-dashboard.sh` - Main tmux launcher
- ✓ `/tmp/install-all-dashboard-components.sh` - Complete installer

## Installation Instructions

### Step 1: SSH to luxlabs-pc

```bash
ssh pilzner@100.83.66.51
```

### Step 2: Run the Complete Installer

```bash
bash /tmp/install-all-dashboard-components.sh
```

**What this does:**
1. Installs system packages (lm-sensors, vnstat, net-tools, tmux)
2. Configures GRUB console blanking (5 minutes)
3. Creates console power management service
4. Disables system sleep/suspend/hibernate
5. Configures TTY1 auto-login for pilzner
6. Installs all 7 dashboard scripts to `/usr/local/bin/`
7. Installs main dashboard launcher
8. Configures auto-start in `.bash_profile` (TTY1 only)
9. Creates rollback script at `/opt/luxlabs/dashboard-rollback.sh`

**You will be prompted for your sudo password** multiple times during installation.

### Step 3: Test the Dashboard Manually

After installation completes:

```bash
luxlabs-dashboard.sh
```

This should launch the tmux dashboard with:
- Header line: Date, time, uptime, load
- 6 panes in 3×2 grid:
  - Top row: CPU/RAM vitals | ChefsBook health | Network stats
  - Bottom row: Infrastructure | Activity | Alerts

**Tmux controls:**
- Detach: `Ctrl-b d`
- Reattach: `tmux attach -t luxlabs-dashboard`
- Kill session: `tmux kill-session -t luxlabs-dashboard`

### Step 4: Final Reboot Test

Once you've verified the dashboard works manually:

```bash
sudo reboot
```

Wait 2-3 minutes, then:

1. The dashboard should auto-start on TTY1 (physical console)
2. SSH back in: `ssh pilzner@100.83.66.51`
3. Check if tmux session is running: `tmux ls`
4. Attach to view: `tmux attach -t luxlabs-dashboard`

## Expected Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ luxlabs-pc | 2026-05-02 14:39:25 EDT | Up 2 days | Load: 0.15 0.12 0.08 │ ← Header
├─────────────────────┬─────────────────────┬─────────────────────────────┤
│  CPU/RAM VITALS     │  CHEFSBOOK STATUS   │  NETWORK STATS              │
│  Temperature: 45°C  │  Web: ✓ Running     │  eth0: 100Mb/s              │
│  CPU: 12%           │  API: ✓ Healthy     │  Tailscale: ✓ Connected     │
│  RAM: 2.1/8.0 GB    │  DB: ✓ Responsive   │  Traffic: ↓ 1.2 MB ↑ 0.8 MB │
├─────────────────────┼─────────────────────┼─────────────────────────────┤
│  INFRASTRUCTURE     │  ACTIVITY LOG       │  ALERTS                     │
│  RPi5: ✓ Up         │  [14:38] API call   │  🟢 All systems normal      │
│  Volumes: 3/3 OK    │  [14:37] Web hit    │  No critical alerts         │
│  Containers: 12/12  │  [14:35] DB query   │  Last check: 14:39:20       │
└─────────────────────┴─────────────────────┴─────────────────────────────┘
```

All panes refresh every 5 seconds.

## Rollback

If you need to undo everything:

```bash
sudo bash /opt/luxlabs/dashboard-rollback.sh
sudo reboot
```

This will:
- Restore GRUB config from backup
- Remove console-power.service
- Remove TTY1 auto-login
- Remove all dashboard scripts
- Restore original .bash_profile

## Troubleshooting

### Dashboard doesn't auto-start on reboot

Check if .bash_profile is being sourced:
```bash
cat ~/.bash_profile | grep luxlabs
```

Verify the tty1 auto-login is working:
```bash
systemctl status getty@tty1
```

### Pane shows errors

Test individual scripts:
```bash
lb-header.sh
lb-pane1-vitals.sh
lb-pane2-chefsbook.sh
lb-pane3-network.sh
lb-pane4-infra.sh
lb-pane5-activity.sh
lb-pane6-alerts.sh
```

### tmux session exists but won't attach

Kill and restart:
```bash
tmux kill-session -t luxlabs-dashboard
luxlabs-dashboard.sh
```

## Files Created

**System Configuration:**
- `/etc/default/grub` (modified, backed up to .bak)
- `/etc/systemd/system/console-power.service`
- `/etc/systemd/system/getty@tty1.service.d/override.conf`

**Dashboard Scripts:**
- `/usr/local/bin/lb-header.sh`
- `/usr/local/bin/lb-pane1-vitals.sh`
- `/usr/local/bin/lb-pane2-chefsbook.sh`
- `/usr/local/bin/lb-pane3-network.sh`
- `/usr/local/bin/lb-pane4-infra.sh`
- `/usr/local/bin/lb-pane5-activity.sh`
- `/usr/local/bin/lb-pane6-alerts.sh`
- `/usr/local/bin/luxlabs-dashboard.sh` (main launcher)

**User Configuration:**
- `~/.bash_profile` (modified, backed up with timestamp)

**Utilities:**
- `/opt/luxlabs/dashboard-rollback.sh`

## What Happens on TTY1 vs SSH

**TTY1 (Physical Console):**
- Auto-login as pilzner
- Dashboard auto-starts immediately
- No password prompt

**SSH Sessions:**
- Normal login prompt
- Dashboard does NOT auto-start
- Can manually attach: `tmux attach -t luxlabs-dashboard`
- Or run your own commands normally

The `.bash_profile` hook only triggers on tty1, so SSH sessions are unaffected.

## Next Steps After Installation

Once the dashboard is working:

1. **Monitor for a few days** - Verify all panes show correct data
2. **Tune refresh rate** - Currently 5s, can adjust in luxlabs-dashboard.sh
3. **Add custom alerts** - Modify lb-pane6-alerts.sh for your needs
4. **Customize colors** - Edit individual pane scripts for different thresholds
5. **Add more metrics** - Extend any pane script as needed

## Support

All installation files are on luxlabs-pc:
- Main installer: `/tmp/install-all-dashboard-components.sh`
- Rollback script: `/opt/luxlabs/dashboard-rollback.sh` (created after install)
- Individual pane scripts: `/usr/local/bin/lb-*.sh`

To see this document again:
```bash
cat > ~/DASHBOARD-INSTRUCTIONS.md
# (paste this content)
```
