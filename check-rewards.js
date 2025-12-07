const { KickReward } = require('./src/models');

async function checkRewards() {
    try {
        console.log('🎁 Consultando recompensas configuradas...\n');
        
        const rewards = await KickReward.findAll({
            attributes: ['id', 'kick_reward_id', 'title', 'cost', 'puntos_a_otorgar', 'auto_accept', 'is_enabled'],
            order: [['cost', 'ASC']]
        });

        if (rewards.length === 0) {
            console.log('❌ No hay recompensas configuradas\n');
            console.log('💡 Las recompensas se detectarán automáticamente cuando alguien canjee.');
            console.log('💡 Después podrás configurar los puntos a otorgar.\n');
        } else {
            console.log(`✅ Total de recompensas: ${rewards.length}\n`);
            console.log('═══════════════════════════════════════════════════════════════════');
            
            rewards.forEach(reward => {
                console.log(`\n📦 ${reward.title}`);
                console.log(`   ID Kick: ${reward.kick_reward_id}`);
                console.log(`   Costo: ${reward.cost} puntos de canal`);
                console.log(`   Otorga: ${reward.puntos_a_otorgar} puntos en tienda`);
                console.log(`   Auto-aceptar: ${reward.auto_accept ? '✅' : '❌'}`);
                console.log(`   Habilitada: ${reward.is_enabled ? '✅' : '❌'}`);
            });
            
            console.log('\n═══════════════════════════════════════════════════════════════════\n');
        }

        // Verificar específicamente las recompensas mencionadas
        console.log('🔍 Verificando recompensas específicas:\n');
        
        const reward5k = rewards.find(r => r.title && r.title.toLowerCase().includes('5') && r.title.toLowerCase().includes('k'));
        const reward10k = rewards.find(r => r.title && r.title.toLowerCase().includes('10') && r.title.toLowerCase().includes('k'));
        
        console.log(`5K Kiosko:  ${reward5k ? '✅ Configurada' : '❌ No encontrada'}`);
        if (reward5k) {
            console.log(`            Otorga ${reward5k.puntos_a_otorgar} puntos`);
        }
        
        console.log(`10K Kiosko: ${reward10k ? '✅ Configurada' : '❌ No encontrada'}`);
        if (reward10k) {
            console.log(`            Otorga ${reward10k.puntos_a_otorgar} puntos`);
        }

        console.log('\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkRewards();
