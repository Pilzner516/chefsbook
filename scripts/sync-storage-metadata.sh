#!/bin/bash
# Sync storage metadata from PostgreSQL to filesystem extended attributes
# Run this on slux server as pilzner user

set -e

STORAGE_ROOT="/opt/luxlabs/chefsbook/supabase/volumes/storage/stub/stub"

echo "=== Supabase Storage Metadata Sync ==="
echo "This script reads metadata from storage.objects table and sets filesystem xattr"
echo ""

# Check if attr command exists
if ! command -v setfattr &> /dev/null; then
    echo "Error: setfattr command not found. Installing attr package..."
    echo "Run: sudo apt-get update && sudo apt-get install -y attr"
    exit 1
fi

# Get all objects from database with their metadata
echo "Fetching objects from database..."
OBJECTS=$(docker exec supabase-db psql -U postgres -t -A -F'|' -c "
    SELECT
        bucket_id,
        name,
        metadata->>'mimetype' as content_type,
        metadata->>'cacheControl' as cache_control,
        metadata->>'size' as size,
        metadata->>'eTag' as etag
    FROM storage.objects
    WHERE bucket_id IN ('recipe-user-photos', 'avatars')
    ORDER BY bucket_id, name
")

COUNT=0
FIXED=0
ERRORS=0

while IFS='|' read -r bucket name content_type cache_control size etag; do
    ((COUNT++))

    FILEPATH="${STORAGE_ROOT}/${bucket}/${name}"

    if [ ! -f "$FILEPATH" ]; then
        echo "  [SKIP] File not found: $name"
        ((ERRORS++))
        continue
    fi

    # Set extended attributes
    if [ -n "$content_type" ]; then
        setfattr -n user.content-type -v "$content_type" "$FILEPATH" 2>/dev/null || true
    fi

    if [ -n "$cache_control" ]; then
        setfattr -n user.cache-control -v "$cache_control" "$FILEPATH" 2>/dev/null || true
    fi

    if [ -n "$etag" ]; then
        setfattr -n user.etag -v "$etag" "$FILEPATH" 2>/dev/null || true
    fi

    ((FIXED++))

    if [ $((FIXED % 50)) -eq 0 ]; then
        echo "  Processed $FIXED/$COUNT files..."
    fi
done <<< "$OBJECTS"

echo ""
echo "✓ Complete: Fixed $FIXED files, $ERRORS errors, $COUNT total"
echo ""
echo "Restarting supabase-storage container..."
docker restart supabase-storage

echo ""
echo "✓ Done! Test with:"
echo "  curl -I http://100.83.66.51:8000/storage/v1/object/public/recipe-user-photos/b589743b-99bd-4f55-983a-c31f5167c425/1777661798900-kvqlj3.jpg"
