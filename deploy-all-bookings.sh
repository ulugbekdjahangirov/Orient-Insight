#!/bin/bash
# Deploy all bookings from localhost to production
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Deploying all bookings to production..."
echo ""

# Upload export file
echo "📤 Uploading all-bookings-export.json..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/all-bookings-export.json \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Upload import script
echo "📤 Uploading import-all-bookings.js..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/import-all-bookings.js \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Run import on server
echo ""
echo "📥 Importing bookings on production server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node import-all-bookings.js
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check: https://booking-calendar.uz/bookings/"
