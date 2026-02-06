<?php
// Railway Module Deployment - Server Restart Script
// Access via: https://booking-calendar.uz/restart-api.php?key=restart123

$secret_key = 'restart123';

if (!isset($_GET['key']) || $_GET['key'] !== $secret_key) {
    die('Unauthorized');
}

header('Content-Type: text/plain');
echo "=== Restarting Orient Insight API Server ===\n\n";

// Kill existing Node.js process
echo "Stopping server...\n";
exec('sudo pkill -f "node.*index.js"', $output1, $return1);
sleep(2);

// Start server
echo "Starting server...\n";
exec('cd /var/www/booking-calendar/server && sudo nohup node src/index.js > /dev/null 2>&1 &', $output2, $return2);
sleep(2);

// Check if running
exec('ps aux | grep -v grep | grep "node.*index.js"', $output3, $return3);

if ($return3 === 0) {
    echo "\n✓ Server restarted successfully!\n\n";
    echo "Process:\n";
    echo implode("\n", $output3);
} else {
    echo "\n✗ Failed to restart server\n";
    echo "Please restart manually with:\n";
    echo "sudo bash /var/www/booking-calendar/restart-server-root.sh\n";
}

echo "\n\nDone!\n";
?>
