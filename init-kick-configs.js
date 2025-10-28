#!/usr/bin/env node

/**
 * Script para inicializar configuraciones de Kick directamente en la base de datos
 * Este script se ejecuta dentro del contenedor y no depende de sequelize-cli
 */

const { sequelize } = require('./src/models');
const { KickPointsConfig, BotrixMigrationConfig } = require('./src/models');

async function initializeKickConfigs() {
    try {
        console.log('🚀 Inicializando configuraciones de Kick...\n');

        // 1. Inicializar configuración de puntos
        console.log('📦 1. Configuración de puntos Kick...');

        const defaultPointsConfigs = [
            {
                config_key: 'chat_points_regular',
                config_value: 10,
                description: 'Puntos por mensaje en chat (usuarios regulares)',
                enabled: true
            },
            {
                config_key: 'chat_points_subscriber',
                config_value: 20,
                description: 'Puntos por mensaje en chat (suscriptores)',
                enabled: true
            },
            {
                config_key: 'follow_points',
                config_value: 50,
                description: 'Puntos por seguir el canal (primera vez)',
                enabled: true
            },
            {
                config_key: 'subscription_new_points',
                config_value: 500,
                description: 'Puntos por nueva suscripción',
                enabled: true
            },
            {
                config_key: 'subscription_renewal_points',
                config_value: 300,
                description: 'Puntos por renovación de suscripción',
                enabled: true
            },
            {
                config_key: 'gift_given_points',
                config_value: 100,
                description: 'Puntos por cada suscripción regalada',
                enabled: true
            },
            {
                config_key: 'gift_received_points',
                config_value: 400,
                description: 'Puntos por recibir una suscripción regalada',
                enabled: true
            }
        ];

        let pointsCreated = 0;
        let pointsExisting = 0;

        for (const configData of defaultPointsConfigs) {
            const [config, created] = await KickPointsConfig.findOrCreate({
                where: { config_key: configData.config_key },
                defaults: configData
            });

            if (created) {
                pointsCreated++;
                console.log(`  ✅ Creado: ${configData.config_key} = ${configData.config_value} puntos`);
            } else {
                pointsExisting++;
                console.log(`  ⚠️  Ya existe: ${configData.config_key} = ${config.config_value} puntos`);
            }
        }

        console.log(`\n📊 Configuración de puntos: ${pointsCreated} creados, ${pointsExisting} existentes`);

        // 2. Inicializar configuración de migración Botrix
        console.log('\n📦 2. Configuración de migración Botrix...');

        const defaultMigrationConfig = {
            migration_enabled: true,
            vip_points_enabled: false,
            vip_chat_points: 5,
            vip_follow_points: 100,
            vip_sub_points: 300
        };

        let migrationConfig = await BotrixMigrationConfig.findByPk(1);

        if (!migrationConfig) {
            migrationConfig = await BotrixMigrationConfig.create(defaultMigrationConfig);
            console.log('  ✅ Configuración de migración creada');
            console.log(`    - migration_enabled: ${migrationConfig.migration_enabled}`);
            console.log(`    - vip_points_enabled: ${migrationConfig.vip_points_enabled}`);
            console.log(`    - vip_chat_points: ${migrationConfig.vip_chat_points}`);
            console.log(`    - vip_follow_points: ${migrationConfig.vip_follow_points}`);
            console.log(`    - vip_sub_points: ${migrationConfig.vip_sub_points}`);
        } else {
            console.log('  ⚠️  Configuración de migración ya existe');
            console.log(`    - migration_enabled: ${migrationConfig.migration_enabled}`);
            console.log(`    - vip_points_enabled: ${migrationConfig.vip_points_enabled}`);
            console.log(`    - vip_chat_points: ${migrationConfig.vip_chat_points}`);
            console.log(`    - vip_follow_points: ${migrationConfig.vip_follow_points}`);
            console.log(`    - vip_sub_points: ${migrationConfig.vip_sub_points}`);
        }

        console.log('\n🎉 Inicialización completada exitosamente!');
        console.log('\n📋 Resumen:');
        console.log(`- Configuraciones de puntos: ${pointsCreated + pointsExisting} total`);
        console.log('- Configuración de migración: ✅ Lista');
        console.log('\n💡 El frontend ahora debería cargar correctamente las configuraciones');

        process.exit(0);

    } catch (error) {
        console.error('💥 Error inicializando configuraciones:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    initializeKickConfigs();
}

module.exports = { initializeKickConfigs };
