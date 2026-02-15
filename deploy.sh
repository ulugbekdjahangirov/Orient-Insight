#!/bin/bash
# Orient Insight VPS Deployment Script
# Deploy qilish uchun: bash deploy.sh

set -e

# Konfiguratsiya
VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"
DOMAIN="booking-calendar.uz"
PROJECT_PATH="/var/www/booking-calendar"

echo "🚀 Orient Insight loyihasini VPS ga deploy qilish boshlandi..."

# SSH ulanishni tekshirish
echo "📡 SSH ulanishni tekshiryapmiz..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "echo '✅ SSH ulanish muvaffaqiyatli'"

# VPS ga dastlabki sozlamalarni o'rnatish
echo "📦 VPS ga kerakli dasturlarni o'rnatyapmiz..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
set -e

# Node.js o'rnatish
if ! command -v node &> /dev/null; then
    echo "Node.js o'rnatyapmiz..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# PM2 o'rnatish
if ! command -v pm2 &> /dev/null; then
    echo "PM2 o'rnatyapmiz..."
    npm install -g pm2
fi

# Nginx o'rnatish
if ! command -v nginx &> /dev/null; then
    echo "Nginx o'rnatyapmiz..."
    apt-get install -y nginx
fi

# Loyiha papkasini yaratish
mkdir -p /var/www/booking-calendar

echo "✅ Barcha dasturlar o'rnatildi"
ENDSSH

# Loyihani VPS ga yuklash
echo "📤 Loyiha fayllarini yuklaymiz..."

# Server fayllarini yuklash
echo "  → Server fayllar..."
rsync -avz -e "ssh -i '$SSH_KEY'" --exclude 'node_modules' \
    C:/Users/Asus/orient-insight/server/ "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/"

# Client fayllarini yuklash
echo "  → Client fayllar..."
rsync -avz -e "ssh -i '$SSH_KEY'" --exclude 'node_modules' --exclude 'dist' \
    C:/Users/Asus/orient-insight/client/ "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/client/"

# Database faylini yuklash
echo "  → Database fayli..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" "mkdir -p ${PROJECT_PATH}/server/database"
scp -i "$SSH_KEY" C:/Users/Asus/orient-insight/server/database/orient-insight.db \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/server/database/"

# Package.json fayllarini yuklash
echo "  → Package fayllar..."
scp -i "$SSH_KEY" C:/Users/Asus/orient-insight/package*.json \
    "${VPS_USER}@${VPS_IP}:${PROJECT_PATH}/"

echo "✅ Barcha fayllar yuklandi"

# VPS da build va sozlash
echo "🔧 Loyihani build qilyapmiz..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << ENDSSH
set -e
cd ${PROJECT_PATH}

# .env faylini yaratish
cat > server/.env << 'EOF'
DATABASE_URL="file:../database/orient-insight.db"
JWT_SECRET="orient-insight-secret-key-change-in-production"
ENCRYPTION_KEY="orient-insight-encryption-key-32"
PORT=3001
NODE_ENV=production
EOF

# Server dependencies
echo "📦 Server dependencies o'rnatyapmiz..."
cd server
npm install --production
npx prisma generate

# Client build
echo "🏗️ Client build qilyapmiz..."
cd ../client
npm install
npm run build

cd ..

# PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'orient-insight',
    script: './server/src/index.js',
    cwd: '${PROJECT_PATH}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# PM2 ni ishga tushirish
pm2 delete orient-insight 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "✅ Backend PM2 da ishga tushdi"

# Nginx konfiguratsiyasi
cat > /etc/nginx/sites-available/booking-calendar << 'EOF'
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${PROJECT_PATH}/client/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }

    location /uploads {
        proxy_pass http://localhost:3001;
    }

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Nginx ni yoqish
ln -sf /etc/nginx/sites-available/booking-calendar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "✅ Nginx sozlandi"

# Firewall
ufw allow 22/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
echo "y" | ufw enable || true

echo "✅ Firewall sozlandi"
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Ma'lumotlar:"
echo "  🌐 Sayt: http://${DOMAIN}"
echo "  🖥️  Backend: PM2 da ishlamoqda (port 3001)"
echo "  📁 Joylashgan: ${PROJECT_PATH}"
echo "  💾 Database: Orient-insight.db"
echo ""
echo "🔍 Foydali buyruqlar:"
echo "  VPS ga kirish:"
echo "    ssh -i '$SSH_KEY' root@${VPS_IP}"
echo ""
echo "  PM2 buyruqlari:"
echo "    pm2 status                    # Holatni ko'rish"
echo "    pm2 logs orient-insight       # Loglarni ko'rish"
echo "    pm2 restart orient-insight    # Qayta ishga tushirish"
echo "    pm2 stop orient-insight       # To'xtatish"
echo ""
echo "  Nginx:"
echo "    nginx -t                      # Konfigni tekshirish"
echo "    systemctl reload nginx        # Qayta yuklash"
echo ""
echo "🔒 SSL sertifikat o'rnatish uchun:"
echo "  ssh -i '$SSH_KEY' root@${VPS_IP}"
echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "🎉 Saytingiz tayyor: http://${DOMAIN}"
