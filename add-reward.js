/**
 * Script para agregar recompensa de Kick de forma interactiva
 * Uso: node add-reward.js <kick_reward_id> <title> <cost> <puntos_a_otorgar>
 */

const { KickReward } = require('./src/models');

async function addReward() {
    const args = process.argv.slice(2);
    
    if (args.length < 4) {
        console.log('❌ Faltan argumentos\n');
        console.log('Uso: node add-reward.js <kick_reward_id> <title> <cost> <puntos_a_otorgar>');
        console.log('\nEjemplo:');
        console.log('  node add-reward.js "01J8XYZ..." "5K Kiosko" 5000 5000\n');
        process.exit(1);
    }

    const [kickRewardId, title, cost, puntosAOtorgar] = args;

    try {
        console.log('🎁 Agregando recompensa...\n');
        console.log(`   ID Kick: ${kickRewardId}`);
        console.log(`   Título: ${title}`);
        console.log(`   Costo en Kick: ${cost} puntos de canal`);
        console.log(`   Otorga en tienda: ${puntosAOtorgar} puntos`);
        console.log(`   Auto-aceptar: Sí\n`);

        const reward = await KickReward.create({
            kick_reward_id: kickRewardId,
            title: title,
            cost: parseInt(cost),
            puntos_a_otorgar: parseInt(puntosAOtorgar),
            auto_accept: true,
            is_enabled: true
        });

        console.log('✅ Recompensa agregada exitosamente!');
        console.log(`   ID local: ${reward.id}\n`);
        console.log('🎯 Ahora cuando alguien canjee esta recompensa, otorgará puntos automáticamente.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.error('⚠️  Esta recompensa ya existe en la base de datos.\n');
        }
        process.exit(1);
    }
}

addReward();
