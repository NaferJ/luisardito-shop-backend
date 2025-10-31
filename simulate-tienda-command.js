// simulate-tienda-command.js - Simula el comando !tienda cada hora
const kickBotService = require('./src/services/kickBot.service');

async function simulateTiendaCommand() {
    try {
        console.log('🛒 [SIMULATE] Simulando comando !tienda para mantener bot activo...');

        // Simular exactamente lo que hace el webhook cuando alguien escribe !tienda
        const reply = `Luisardito tienda del canal: https://shop.luisardito.com/`;

        console.log(`📤 [SIMULATE] Enviando: "${reply}"`);

        const result = await kickBotService.sendMessage(reply);

        if (result.ok) {
            console.log('✅ [SIMULATE] Comando !tienda simulado exitosamente');
            console.log(`📊 [SIMULATE] Respuesta: ${JSON.stringify(result.data)}`);
        } else {
            console.error('❌ [SIMULATE] Error simulando comando !tienda:', result.error);
            return false;
        }

        return true;

    } catch (error) {
        console.error('❌ [SIMULATE] Error fatal:', error.message);
        return false;
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    simulateTiendaCommand()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error fatal:', error);
            process.exit(1);
        });
}

module.exports = simulateTiendaCommand;
