#!/usr/bin/env node

/**
 * Script para re-autorizar el bot de Kick cuando el refresh token expira
 * Uso: node reauth-bot.js <codigo_autorizacion> <username>
 */

const kickBotService = require('./src/services/kickBot.service');

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('🚨 Uso: node reauth-bot.js <codigo_autorizacion> <username>');
        console.log('');
        console.log('Pasos para re-autorizar:');
        console.log('1. Ve a la URL de autorización:');
        console.log(kickBotService.generateAuthUrl());
        console.log('');
        console.log('2. Autoriza la aplicación y copia el código de la URL de redirección');
        console.log('3. Ejecuta: node reauth-bot.js <codigo> <username>');
        process.exit(1);
    }

    const [code, username] = args;

    try {
        console.log(`🔄 Re-autorizando bot para usuario: ${username}`);
        const tokens = await kickBotService.exchangeCodeForTokens(code, username);
        console.log('✅ Re-autorización exitosa!');
        console.log(`   Usuario: ${tokens.kick_username}`);
        console.log(`   Expira: ${tokens.token_expires_at}`);
        console.log('💡 El bot ahora renovará tokens automáticamente cada 15 minutos.');
    } catch (error) {
        console.error('❌ Error en re-autorización:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
