const { KickBotCommand } = require('./src/models');

async function checkCommands() {
  try {
    console.log('🔍 Verificando comandos existentes...');

    // Buscar comando puntos
    const existingPuntos = await KickBotCommand.findOne({ where: { command: 'puntos' } });
    if (existingPuntos) {
      console.log('✅ Comando !puntos existe:', existingPuntos.command);
      console.log('   - Tipo:', existingPuntos.command_type);
      console.log('   - Handler:', existingPuntos.dynamic_handler);
      console.log('   - Habilitado:', existingPuntos.enabled);
    } else {
      console.log('❌ Comando !puntos NO existe - esto es un problema');
    }

    // Buscar comando discord
    const existingDiscord = await KickBotCommand.findOne({ where: { command: 'discord' } });
    if (existingDiscord) {
      console.log('✅ Comando !discord existe:', existingDiscord.command);
      console.log('   - Tipo:', existingDiscord.command_type);
      console.log('   - Handler:', existingDiscord.dynamic_handler);
      console.log('   - Respuesta:', existingDiscord.response_message);
      console.log('   - Habilitado:', existingDiscord.enabled);
    } else {
      console.log('❌ Comando !discord NO existe - necesitamos crearlo');
    }

    console.log('✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCommands();