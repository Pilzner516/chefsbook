# ClamAV Installation - Manual Steps Required on slux

## Status
Code is deployed and functional with graceful degradation. ClamAV installation requires manual intervention due to sudo password requirement.

## Steps to Complete Installation

### 1. Install ClamAV on slux (requires sudo password)

```bash
ssh pilzner@slux

# Install ClamAV packages
sudo apt-get update
sudo apt-get install -y clamav clamav-daemon

# Update virus signatures (may take a few minutes on first run)
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam

# Enable and start daemon
sudo systemctl enable clamav-daemon
sudo systemctl start clamav-daemon

# Wait 30 seconds for socket to be created, then verify
sleep 30
ls -la /var/run/clamav/clamd.ctl

# Check daemon health
sudo systemctl status clamav-daemon --no-pager
```

### 2. Add environment variable to slux

```bash
ssh pilzner@slux
nano /opt/luxlabs/chefsbook/repo/.env.local

# Add this line:
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl
```

### 3. Restart web server

```bash
ssh pilzner@slux
cd /opt/luxlabs/chefsbook/repo
pm2 restart chefsbook-web
```

### 4. Test virus detection (EICAR test)

Create a file named `eicar.txt` with exactly this content (safe test string):
```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

Test via curl:
```bash
curl -X POST https://chefsbk.app/api/import/file \
  -H "Authorization: Bearer <user_jwt>" \
  -F "file=@eicar.txt;type=application/pdf"

# Expected: HTTP 422, body contains "File rejected for security reasons"
```

## Current Behavior (Before ClamAV Installation)

- File uploads work normally
- CLAMAV_SOCKET env var is not set, so scans are skipped
- Server logs show: "[scanFile] CLAMAV_SOCKET not set — skipping AV scan (dev mode)"
- Files are validated for:
  - Size (20MB limit) ✓
  - MIME type via magic bytes ✓
  - Virus scanning ✗ (skipped with warning)

## After ClamAV Installation

- All three validations will run
- Malicious files will be rejected with HTTP 422
- Daemon health is auto-maintained by systemd
- Signatures auto-update daily via clamav-freshclam service
