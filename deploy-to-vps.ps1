# Orient Insight VPS Deployment Script
# This script will automatically deploy the project to booking-calendar.uz

Write-Host "🚀 Starting Orient Insight deployment to VPS..." -ForegroundColor Green

# Configuration
$VPS_IP = "95.46.96.65"
$VPS_USER = "root"
$VPS_PASSWORD = "AngpTADs"
$SSH_KEY_PATH = "C:\Users\Asus\Desktop\ssh key\ssh.txt"
$DOMAIN = "booking-calendar.uz"
$PROJECT_PATH = "/var/www/booking-calendar"
$LOCAL_PROJECT = "C:\Users\Asus\orient-insight"

# Function to execute SSH commands
function Invoke-SSHCommand {
    param(
        [string]$Command
    )
    Write-Host "Executing: $Command" -ForegroundColor Yellow
    $plink = "plink.exe"
    if (!(Get-Command $plink -ErrorAction SilentlyContinue)) {
        Write-Host "Installing plink (PuTTY)..." -ForegroundColor Yellow
        # Use ssh.exe instead (available in Windows 10+)
        $result = ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "$Command" 2>&1
    } else {
        $result = & $plink -i "$SSH_KEY_PATH" -batch "${VPS_USER}@${VPS_IP}" "$Command" 2>&1
    }
    return $result
}

Write-Host "`n📦 Step 1: Preparing local project..." -ForegroundColor Cyan
cd $LOCAL_PROJECT

# Create .env.production for server if not exists
$envContent = @"
DATABASE_URL="file:../database/orient-insight.db"
JWT_SECRET="orient-insight-secret-key-change-in-production"
ENCRYPTION_KEY="orient-insight-encryption-key-32"
PORT=3001
NODE_ENV=production
"@

Set-Content -Path "$LOCAL_PROJECT\server\.env.production" -Value $envContent
Write-Host "✅ Production .env file prepared" -ForegroundColor Green

Write-Host "`n🔗 Step 2: Connecting to VPS and installing dependencies..." -ForegroundColor Cyan

# Test SSH connection
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${VPS_USER}@${VPS_IP}" "echo 'SSH connection successful'" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SSH connection failed. Trying with password..." -ForegroundColor Red
    Write-Host "Please install 'sshpass' or use PuTTY's plink" -ForegroundColor Yellow
    exit 1
}

# Create project directory and install Node.js
$setupScript = @'
#!/bin/bash
set -e

echo "📦 Installing Node.js and dependencies..."

# Update system
apt-get update -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install nginx
apt-get install -y nginx

# Install certbot for SSL
apt-get install -y certbot python3-certbot-nginx

echo "✅ Dependencies installed"

# Create project directory
mkdir -p /var/www/booking-calendar
chown -R root:root /var/www/booking-calendar
'@

# Save and execute setup script
$setupScript | ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" "cat > /tmp/setup.sh && chmod +x /tmp/setup.sh && bash /tmp/setup.sh"

Write-Host "`n📤 Step 3: Uploading project files..." -ForegroundColor Cyan

# Use rsync or scp to copy files
Write-Host "Copying server files..." -ForegroundColor Yellow
scp -i "$SSH_KEY_PATH" -r "$LOCAL_PROJECT\server" "${VPS_USER}@${VPS_IP}:$PROJECT_PATH/"

Write-Host "Copying client files..." -ForegroundColor Yellow
scp -i "$SSH_KEY_PATH" -r "$LOCAL_PROJECT\client" "${VPS_USER}@${VPS_IP}:$PROJECT_PATH/"

Write-Host "Copying package files..." -ForegroundColor Yellow
scp -i "$SSH_KEY_PATH" "$LOCAL_PROJECT\package*.json" "${VPS_USER}@${VPS_IP}:$PROJECT_PATH/"

Write-Host "`n📊 Step 4: Uploading database..." -ForegroundColor Cyan
ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" "mkdir -p $PROJECT_PATH/server/database"
scp -i "$SSH_KEY_PATH" "$LOCAL_PROJECT\server\database\orient-insight.db" "${VPS_USER}@${VPS_IP}:$PROJECT_PATH/server/database/"

Write-Host "`n🔧 Step 5: Building and configuring application..." -ForegroundColor Cyan

$buildScript = @"
#!/bin/bash
set -e

cd $PROJECT_PATH

echo "📦 Installing dependencies..."

# Server dependencies
cd server
npm install --production
cp .env.production .env

# Generate Prisma client
npx prisma generate

cd ..

# Client dependencies and build
cd client
npm install
npm run build

cd ..

echo "✅ Build completed"

# Configure PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'orient-insight-backend',
    script: './server/src/index.js',
    cwd: '$PROJECT_PATH',
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

# Stop existing PM2 process if any
pm2 delete orient-insight-backend 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | bash

echo "✅ Backend started with PM2"
"@

$buildScript | ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" "cat > /tmp/build.sh && chmod +x /tmp/build.sh && bash /tmp/build.sh"

Write-Host "`n🌐 Step 6: Configuring Nginx..." -ForegroundColor Cyan

$nginxConfig = @"
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Serve client build
    root $PROJECT_PATH/client/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads proxy
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
"@

$nginxConfig | ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" "cat > /etc/nginx/sites-available/booking-calendar"

ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" @"
ln -sf /etc/nginx/sites-available/booking-calendar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
"@

Write-Host "`n🔥 Step 7: Configuring firewall..." -ForegroundColor Cyan
ssh -i "$SSH_KEY_PATH" "${VPS_USER}@${VPS_IP}" @"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
"@

Write-Host "`n🔒 Step 8: Setting up SSL (optional)..." -ForegroundColor Cyan
Write-Host "To enable HTTPS, run this command on the VPS:" -ForegroundColor Yellow
Write-Host "certbot --nginx -d $DOMAIN -d www.$DOMAIN" -ForegroundColor White

Write-Host "`n✅ DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "`n📋 Summary:" -ForegroundColor Cyan
Write-Host "  - Backend running on PM2 (port 3001)" -ForegroundColor White
Write-Host "  - Frontend built and served by Nginx" -ForegroundColor White
Write-Host "  - Database copied successfully" -ForegroundColor White
Write-Host "  - Domain: http://$DOMAIN" -ForegroundColor White
Write-Host "`n🔍 Useful commands:" -ForegroundColor Cyan
Write-Host "  ssh -i '$SSH_KEY_PATH' root@$VPS_IP" -ForegroundColor White
Write-Host "  pm2 status" -ForegroundColor White
Write-Host "  pm2 logs orient-insight-backend" -ForegroundColor White
Write-Host "  pm2 restart orient-insight-backend" -ForegroundColor White
Write-Host "  nginx -t && systemctl reload nginx" -ForegroundColor White
Write-Host "`n🌐 Visit: http://$DOMAIN" -ForegroundColor Green
