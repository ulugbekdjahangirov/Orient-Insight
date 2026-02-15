#!/bin/bash
# Deploy updated client to production using scp
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Deploying updated client to production..."
echo ""

# Create a tarball of the dist directory
echo "📦 Creating tarball..."
cd C:/Users/Asus/orient-insight/client
tar -czf dist.tar.gz -C dist .

# Upload tarball
echo "📤 Uploading client files..."
scp -i "$SSH_KEY" dist.tar.gz "${VPS_USER}@${VPS_IP}:/tmp/"

# Extract on server
echo "📂 Extracting on server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/client
# Backup current dist
if [ -d "dist" ]; then
    mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi
# Create new dist and extract
mkdir -p dist
cd dist
tar -xzf /tmp/dist.tar.gz
rm /tmp/dist.tar.gz
# Reload nginx
systemctl reload nginx
echo "✅ Extraction complete"
ENDSSH

# Clean up local tarball
rm C:/Users/Asus/orient-insight/client/dist.tar.gz

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLIENT DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check: https://booking-calendar.uz/price"
echo "💡 Clear browser cache (Ctrl+Shift+R) to see changes"
echo ""
