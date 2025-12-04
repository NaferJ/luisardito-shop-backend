#!/usr/bin/env node

/**
 * Script para agregar la configuración kicks_gifted_multiplier
 * Este script agrega el multiplicador para puntos por kicks regalados
 * 
 * Ejecutar: node add-kicks-gifted-multiplier-config.js
 */

const { sequelize } = require('./src/models');
const { KickPointsConfig } = require('./src/models');

async function addKicksGiftedMultiplierConfig() {
    try {
        console.log('🚀 Agregando configuración kicks_gifted_multiplier...\n');

        await sequelize.authenticate();
        console.log('✅ Conectado a la base de datos\n');

        const [config, created] = await KickPointsConfig.findOrCreate({
            where: { config_key: 'kicks_gifted_multiplier' },
            defaults: {
                config_key: 'kicks_gifted_multiplier',
                config_value: 2,
                description: 'Multiplicador de puntos por kicks regalados',
                enabled: true
            }
        });

        if (created) {
            console.log('✅ Configuración creada exitosamente:');
            console.log(`   - config_key: ${config.config_key}`);
            console.log(`   - config_value: ${config.config_value}`);
            console.log(`   - description: ${config.description}`);
            console.log(`   - enabled: ${config.enabled}`);
        } else {
            console.log('⚠️  La configuración ya existe:');
            console.log(`   - config_key: ${config.config_key}`);
            console.log(`   - config_value: ${config.config_value}`);
            console.log(`   - description: ${config.description}`);
            console.log(`   - enabled: ${config.enabled}`);
        }

        console.log('\n🎉 Proceso completado!');
        console.log('\n💡 Ahora los puntos por kicks regalados usarán este multiplicador (por defecto x2)');

        process.exit(0);

    } catch (error) {
        console.error('💥 Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    addKicksGiftedMultiplierConfig();
}

module.exports = { addKicksGiftedMultiplierConfig };
