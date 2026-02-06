#!/bin/bash

# Production server deployment script
# This script should be run ON THE SERVER via SSH

echo "=== Railway Module Deployment ==="
echo ""

# Navigate to server directory
cd /var/www/booking-calendar/server || exit 1

echo "Current directory: $(pwd)"
echo ""

# Run Prisma migration
echo "Running Prisma migration..."
npx prisma db push --accept-data-loss

echo ""
echo "Generating Prisma Client..."
npm run db:generate

echo ""
echo "Restarting Node.js server..."
pkill -f 'node.*index.js'
sleep 2
nohup node src/index.js > /dev/null 2>&1 &

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Check if server is running:"
sleep 3
ps aux | grep 'node.*index.js' | grep -v grep
