#!/bin/bash
# Deploy prices to production server
set -e

# Configuration
VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"
EXPORT_FILE="server/scripts/price-export.json"
IMPORT_SCRIPT="server/scripts/import-prices.js"

echo "🚀 Deploying prices to booking-calendar.uz..."
echo ""

# Check if export file exists
if [ ! -f "$EXPORT_FILE" ]; then
    echo "❌ Export file not found: $EXPORT_FILE"
    echo "Run 'cd server && node scripts/export-prices.js' first"
    exit 1
fi

# Upload export file
echo "📤 Uploading price export file..."
scp -i "$SSH_KEY" "$EXPORT_FILE" "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/scripts/"

# Upload import script (in case it was updated)
echo "📤 Uploading import script..."
scp -i "$SSH_KEY" "$IMPORT_SCRIPT" "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/scripts/"

# Run import on production server
echo ""
echo "📥 Importing prices on production server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node scripts/import-prices.js
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PRICE DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check prices at: https://booking-calendar.uz/price"
echo ""
