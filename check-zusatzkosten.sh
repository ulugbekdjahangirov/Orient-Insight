#!/bin/bash
# Check Zusatzkosten data in production
set -e

VPS_IP="95.46.96.65"
VPS_USER="root"
SSH_KEY="C:/Users/Asus/Desktop/ssh key/ssh.txt"

echo "🔍 Checking Zusatzkosten data in production..."
echo ""

ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_IP}" << 'ENDSSH'
cd /var/www/booking-calendar/server
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Check all zusatzkosten records
    const zusatzkosten = await prisma.priceConfig.findMany({
      where: {
        category: 'zusatzkosten'
      },
      select: {
        tourType: true,
        category: true,
        paxTier: true,
        itemsJson: true
      }
    });

    console.log('Total Zusatzkosten records:', zusatzkosten.length);
    console.log('');

    if (zusatzkosten.length > 0) {
      zusatzkosten.forEach(z => {
        console.log(\`\${z.tourType} | \${z.paxTier}\`);
        const items = JSON.parse(z.itemsJson);
        console.log(\`  Items count: \${items.length}\`);
        if (items.length > 0) {
          console.log(\`  First item:\`, items[0]);
        }
        console.log('');
      });
    } else {
      console.log('❌ No Zusatzkosten data found!');
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
echo "✅ Check complete"
