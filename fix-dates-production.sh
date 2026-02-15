#!/bin/bash
# Fix booking 23 tourist dates in production
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🔧 Fixing booking 23 tourist dates in production..."
echo ""

# Upload fix script
echo "📤 Uploading fix-booking-23-dates.js..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/fix-booking-23-dates.js \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Run fix on server
echo ""
echo "🔧 Running date fix on production server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node fix-booking-23-dates.js
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DATES FIXED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Refresh: https://booking-calendar.uz/bookings/23?edit=true"
echo "💡 Press Ctrl+Shift+R to clear cache"
