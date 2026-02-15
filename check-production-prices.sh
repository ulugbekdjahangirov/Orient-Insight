#!/bin/bash
# Check production prices
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"

echo "🔍 Checking production prices..."
echo ""

# Check database
echo "📊 Database check:"
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const count = await prisma.priceConfig.count();
    console.log('Total records in DB:', count);

    // Check ER hotels for 4 PAX
    const erHotels4 = await prisma.priceConfig.findUnique({
      where: {
        tourType_category_paxTier: {
          tourType: 'ER',
          category: 'hotels',
          paxTier: '4'
        }
      }
    });

    if (erHotels4) {
      console.log('\\nER Hotels 4 PAX found!');
      console.log('Items JSON length:', erHotels4.itemsJson.length, 'chars');
      const items = JSON.parse(erHotels4.itemsJson);
      console.log('Number of hotel items:', items.length);
      if (items.length > 0) {
        console.log('First hotel:', JSON.stringify(items[0], null, 2));
      }
    } else {
      console.log('\\n❌ ER Hotels 4 PAX NOT found!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
})();
"
ENDSSH

echo ""
echo "🌐 API endpoint check:"
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
# Check if API is responding
echo "Testing API endpoint..."
curl -s http://localhost:3001/api/prices/ER/hotels/4 | head -c 200
echo ""
echo ""
echo "Testing auth endpoint..."
curl -s http://localhost:3001/api/health || echo "Health check failed"
ENDSSH

echo ""
echo "✅ Check complete"
