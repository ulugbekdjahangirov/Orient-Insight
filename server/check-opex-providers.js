const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOpexProviders() {
  try {
    // Get all unique providers
    const allOpex = await prisma.opex.findMany({
      select: {
        provider: true,
        name: true,
        seats: true,
        tagRate: true,
        urgenchRate: true
      }
    });

    // Group by provider
    const byProvider = {};
    allOpex.forEach(v => {
      if (!byProvider[v.provider]) {
        byProvider[v.provider] = [];
      }
      byProvider[v.provider].push(v);
    });

    console.log('\n📊 OPEX Providers Summary:\n');
    Object.keys(byProvider).sort().forEach(provider => {
      const vehicles = byProvider[provider];
      console.log(`${provider}: ${vehicles.length} vehicles`);
      vehicles.forEach(v => {
        console.log(`  - ${v.name} (${v.seats} seats): TAG=$${v.tagRate}, URGENCH=$${v.urgenchRate}`);
      });
      console.log('');
    });

    // Check specifically for sevil-co
    const sevilCo = byProvider['sevil-co'] || [];
    if (sevilCo.length === 0) {
      console.log('⚠️ WARNING: No "sevil-co" provider found in OPEX table!');
      console.log('This is why CO groups are not getting correct prices.\n');

      console.log('Available Sevil variants:');
      Object.keys(byProvider).filter(p => p.startsWith('sevil')).forEach(p => {
        console.log(`  - ${p}: ${byProvider[p].length} vehicles`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOpexProviders();
