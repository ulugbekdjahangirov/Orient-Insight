#!/bin/bash
# Deploy booking 23 routes to production
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Deploying booking 23 routes to production..."
echo ""

# Upload JSON file
echo "📤 Uploading booking-23-routes.json..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/booking-23-routes.json \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Upload import script
echo "📤 Uploading import-booking-23-routes.js..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/import-booking-23-routes.js \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Run import on server
echo ""
echo "📥 Running import on production server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node import-booking-23-routes.js
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BOOKING 23 ROUTES IMPORTED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check: https://booking-calendar.uz/bookings/23?edit=true"
