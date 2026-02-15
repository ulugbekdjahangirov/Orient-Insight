#!/bin/bash
# Deploy backend code only
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Deploying backend code to production..."
echo ""

# Upload tourist.routes.js
echo "📤 Uploading tourist.routes.js..."
scp -i "$SSH_KEY" \
    C:/Users/Asus/orient-insight/server/src/routes/tourist.routes.js \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/src/routes/"

# Restart server
echo ""
echo "🔄 Restarting Node.js server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar
pm2 restart orient-insight
pm2 logs orient-insight --lines 20
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BACKEND DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
