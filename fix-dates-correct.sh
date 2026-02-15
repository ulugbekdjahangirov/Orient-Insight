#!/bin/bash
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🔧 Setting correct dates for booking 23..."
echo ""

# Upload script
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/fix-booking-23-dates-correct.js \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Run on server
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node fix-booking-23-dates-correct.js
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DATES FIXED CORRECTLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Tour Start: 21.09.2025"
echo "Arrival: 22.09.2025"
echo "Tour End: 04.10.2025"
echo ""
echo "🌐 https://booking-calendar.uz/bookings/23?edit=true"
