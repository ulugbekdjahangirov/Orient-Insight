#!/bin/bash
# Deploy updated client to production
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Deploying updated client to production..."
echo ""

# Upload built client files
echo "📤 Uploading client dist files..."
rsync -avz --delete -e "ssh -i '$SSH_KEY'" \
    C:/Users/Asus/orient-insight/client/dist/ \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/client/dist/"

# Reload nginx to clear cache
echo ""
echo "🔄 Reloading Nginx..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" "systemctl reload nginx"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLIENT DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check: https://booking-calendar.uz/price"
echo "💡 Clear browser cache (Ctrl+Shift+R) to see changes"
echo ""
