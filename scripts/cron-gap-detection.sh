#!/bin/bash
# Daily knowledge gap detection cron job
# Runs at 3am daily on slux
# Add to crontab: 0 3 * * * /opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh

set -e

# Get service role key from environment
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set"
  exit 1
fi

# Call the gap detection endpoint
RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/knowledge-gaps/detect \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Log the result
DATE=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="/opt/luxlabs/chefsbook/logs/gap-detection.log"

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$DATE] SUCCESS: $BODY" >> "$LOG_FILE"
  exit 0
else
  echo "[$DATE] ERROR (HTTP $HTTP_CODE): $BODY" >> "$LOG_FILE"
  exit 1
fi
