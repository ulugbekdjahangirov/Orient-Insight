#!/bin/bash

FTP_HOST="95.46.96.65:21"
FTP_USER="discovery-insight"
FTP_PASS="Jaha@1987"
REMOTE_PATH="/www/booking-calendar/client"
LOCAL_PATH="C:/Users/Asus/orient-insight/client/dist"

echo "Uploading client build files..."

# Upload index.html
echo "Uploading index.html..."
curl -u "$FTP_USER:$FTP_PASS" "ftp://$FTP_HOST$REMOTE_PATH/index.html" -T "$LOCAL_PATH/index.html"

# Upload logo.png
echo "Uploading logo.png..."
curl -u "$FTP_USER:$FTP_PASS" "ftp://$FTP_HOST$REMOTE_PATH/logo.png" -T "$LOCAL_PATH/logo.png"

# Create assets directory and upload files
echo "Uploading CSS..."
curl -u "$FTP_USER:$FTP_PASS" "ftp://$FTP_HOST$REMOTE_PATH/assets/index-BVpT6ube.css" -T "$LOCAL_PATH/assets/index-BVpT6ube.css" --ftp-create-dirs

echo "Uploading JS..."
curl -u "$FTP_USER:$FTP_PASS" "ftp://$FTP_HOST$REMOTE_PATH/assets/index-DpGT4K_o.js" -T "$LOCAL_PATH/assets/index-DpGT4K_o.js" --ftp-create-dirs

echo "Client upload complete!"
