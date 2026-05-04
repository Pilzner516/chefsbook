#!/bin/bash
# Run this script on slux to fix SSH key authentication
# Execute as the Pilzner user (or lowercase pilzner if that's the correct username)

echo "=== SSH Key Setup Troubleshooting ==="
echo ""

# Step 1: Check current user
echo "Current user:"
whoami
echo ""

# Step 2: Create .ssh directory if it doesn't exist
echo "Creating/verifying .ssh directory..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "✓ Directory created with permissions 700"
echo ""

# Step 3: Add the SSH key
echo "Adding SSH public key to authorized_keys..."
cat >> ~/.ssh/authorized_keys <<'SSHKEY'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHjb0+JmsAo50u0rEH4782It8fc1t+xnAht/eOuLNSIh timelapse-dev
SSHKEY

echo "✓ Key appended to authorized_keys"
echo ""

# Step 4: Set correct permissions
echo "Setting correct permissions..."
chmod 600 ~/.ssh/authorized_keys
echo "✓ authorized_keys permissions set to 600"
echo ""

# Step 5: Verify setup
echo "=== Verification ==="
echo ""
echo "User: $(whoami)"
echo "Home: $HOME"
echo ""
echo "~/.ssh permissions:"
ls -ld ~/.ssh
echo ""
echo "~/.ssh/authorized_keys permissions:"
ls -l ~/.ssh/authorized_keys
echo ""
echo "Number of keys in authorized_keys:"
grep -c "^ssh-" ~/.ssh/authorized_keys 2>/dev/null || echo "0"
echo ""
echo "=== Setup Complete ==="
echo ""
echo "From dev machine, try: ssh $(whoami)@100.83.66.51"
