#!/bin/bash

FTP_HOST="95.46.96.65:21"
FTP_USER="discovery-insight"
FTP_PASS="Jaha@1987"
REMOTE_PATH="/www/booking-calendar"
LOCAL_PATH="C:/Users/Asus/orient-insight"

echo "=== Orient Insight Production Deployment ==="
echo "Uploading to: ftp://$FTP_HOST$REMOTE_PATH"
echo ""

# Function to upload file
upload_file() {
    local file=$1
    local remote=$2
    echo "Uploading: $remote"
    curl -s -u "$FTP_USER:$FTP_PASS" "ftp://$FTP_HOST$remote" -T "$file" --ftp-create-dirs
    if [ $? -eq 0 ]; then
        echo "✓ Success: $remote"
    else
        echo "✗ Failed: $remote"
    fi
}

# Upload CLIENT files
echo ""
echo "=== Uploading CLIENT files ==="
upload_file "$LOCAL_PATH/client/dist/index.html" "$REMOTE_PATH/client/index.html"
upload_file "$LOCAL_PATH/client/dist/logo.png" "$REMOTE_PATH/client/logo.png"

# Upload new CSS and JS files
for file in "$LOCAL_PATH/client/dist/assets"/*; do
    filename=$(basename "$file")
    upload_file "$file" "$REMOTE_PATH/client/assets/$filename"
done

# Upload SERVER files
echo ""
echo "=== Uploading SERVER files ==="

# Upload schema.prisma
upload_file "$LOCAL_PATH/server/prisma/schema.prisma" "$REMOTE_PATH/server/prisma/schema.prisma"

# Upload tourist.routes.js
upload_file "$LOCAL_PATH/server/src/routes/tourist.routes.js" "$REMOTE_PATH/server/src/routes/tourist.routes.js"

# Upload package.json
upload_file "$LOCAL_PATH/server/package.json" "$REMOTE_PATH/server/package.json"

echo ""
echo "=== Upload Complete! ==="
echo ""
echo "Next steps on server:"
echo "1. SSH into server: ssh discovery-insight@95.46.96.65"
echo "2. cd /www/booking-calendar/server"
echo "3. npx prisma db push --accept-data-loss"
echo "4. npm run db:generate"
echo "5. pkill -f 'node.*index.js' && nohup node src/index.js > /dev/null 2>&1 &"
echo ""
