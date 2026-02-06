#!/bin/bash

# Backup current database
sudo cp /var/www/booking-calendar/server/database/orient-insight.db /var/www/booking-calendar/server/database/orient-insight.db.backup

# Copy new database
sudo cp /tmp/orient-insight.db /var/www/booking-calendar/server/database/orient-insight.db

# Set correct permissions
sudo chown root:root /var/www/booking-calendar/server/database/orient-insight.db
sudo chmod 644 /var/www/booking-calendar/server/database/orient-insight.db

# Restart Node.js server
sudo pkill -f 'node.*index.js'
sleep 2
cd /var/www/booking-calendar/server && nohup sudo node src/index.js > /dev/null 2>&1 &

echo "Database updated successfully!"
ls -lh /var/www/booking-calendar/server/database/
