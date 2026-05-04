#!/bin/bash
# Fix Supabase storage extended attributes after migration
# The files were copied from Pi without -X flag, missing xattr metadata
# This causes "The extended attribute does not exist" errors

set -e

echo "=== Supabase Storage xattr Fix ==="
echo ""
echo "This script will re-sync storage files from the Pi with extended attributes preserved."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

SOURCE_HOST="rasp@rpi5-eth"
SOURCE_PATH="/mnt/chefsbook/supabase/volumes/storage/"
DEST_HOST="pilzner@slux"
DEST_PATH="/opt/luxlabs/chefsbook/supabase/volumes/storage/"

echo ""
echo "Source: ${SOURCE_HOST}:${SOURCE_PATH}"
echo "Destination: ${DEST_HOST}:${DEST_PATH}"
echo ""
echo "Starting rsync with xattr preservation (-aX flags)..."
echo ""

# Use rsync with -X to preserve extended attributes
# -a = archive mode (preserves permissions, times, etc)
# -X = preserve extended attributes
# -v = verbose
# --progress = show progress
# --delete = delete files on destination that don't exist on source
ssh ${DEST_HOST} "rsync -aXv --progress ${SOURCE_HOST}:${SOURCE_PATH} ${DEST_PATH}"

echo ""
echo "✓ Storage files re-synced with extended attributes"
echo ""
echo "Restarting supabase-storage container..."
ssh ${DEST_HOST} "docker restart supabase-storage"

echo ""
echo "✓ Done! Test image access with:"
echo "  curl -I http://100.83.66.51:8000/storage/v1/object/public/recipe-user-photos/b589743b-99bd-4f55-983a-c31f5167c425/1777661798900-kvqlj3.jpg"
