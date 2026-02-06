#!/bin/bash
# IMPORTANT: This script must be run with ROOT privileges
# Run with: sudo bash restart-server-root.sh

echo "=== Restarting Orient Insight Server ==="
echo ""

# Kill existing Node.js process
echo "Stopping server..."
pkill -f 'node.*index.js'

# Wait for graceful shutdown
sleep 3

# Start server in background
echo "Starting server..."
cd /var/www/booking-calendar/server
nohup node src/index.js > /dev/null 2>&1 &

# Check if started
sleep 2
if ps aux | grep -v grep | grep 'node.*index.js' > /dev/null; then
    echo "✓ Server restarted successfully!"
    ps aux | grep -v grep | grep 'node.*index.js'
else
    echo "✗ Failed to start server"
    exit 1
fi
