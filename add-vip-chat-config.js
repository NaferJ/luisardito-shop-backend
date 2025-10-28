#!/usr/bin/env node

/**
 * Script para agregar solo la configuración VIP nueva sin afectar las existentes
 */

const { KickPointsConfig } = require('./src/models');

async function addVipChatConfig() {
    try {
        console.log('🎯 Agregando configuración de puntos VIP...\n');

        // Verificar si ya existe
        const existingVipConfig = await KickPointsConfig.findOne({
            where: { config_key: 'chat_points_vip' }
        });

        if (existingVipConfig) {
            console.log('⚠️ La configuración VIP ya existe:');
            console.log(`   config_key: ${existingVipConfig.config_key}`);
            console.log(`   config_value: ${existingVipConfig.config_value}`);
            console.log(`   description: ${existingVipConfig.description}`);
            console.log(`   enabled: ${existingVipConfig.enabled}`);
            return;
        }

        // Crear la configuración VIP
        const vipConfig = await KickPointsConfig.create({
            config_key: 'chat_points_vip',
            config_value: 30,
            description: 'Puntos por mensaje en chat (usuarios VIP)',
            enabled: true
        });

        console.log('✅ Configuración VIP agregada exitosamente:');
        console.log(`   ID: ${vipConfig.id}`);
        console.log(`   config_key: ${vipConfig.config_key}`);
        console.log(`   config_value: ${vipConfig.config_value}`);
        console.log(`   description: ${vipConfig.description}`);
        console.log(`   enabled: ${vipConfig.enabled}`);

        // Verificar todas las configuraciones actuales
        console.log('\n📋 Configuraciones actuales:');
        const allConfigs = await KickPointsConfig.findAll({
            order: [['config_key', 'ASC']]
        });

        allConfigs.forEach(config => {
            console.log(`   - ${config.config_key}: ${config.config_value} (${config.enabled ? 'habilitado' : 'deshabilitado'})`);
        });

        console.log('\n🎉 ¡Configuración VIP lista! Ahora los VIPs ganarán más puntos por chat.');

    } catch (error) {
        console.error('❌ Error agregando configuración VIP:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    addVipChatConfig();
}

module.exports = { addVipChatConfig };
