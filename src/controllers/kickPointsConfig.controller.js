const { KickPointsConfig } = require('../models');

/**
 * Obtiene toda la configuración de puntos
 */
exports.getConfig = async (req, res) => {
    try {
        const config = await KickPointsConfig.findAll({
            order: [['config_key', 'ASC']]
        });

        return res.json({
            config,
            total: config.length
        });

    } catch (error) {
        console.error('[Kick Points Config] Error obteniendo configuración:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Actualiza un valor de configuración
 */
exports.updateConfig = async (req, res) => {
    try {
        const { config_key, config_value, enabled } = req.body;

        if (!config_key) {
            return res.status(400).json({ error: 'config_key es requerido' });
        }

        const config = await KickPointsConfig.findOne({
            where: { config_key }
        });

        if (!config) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }

        const updateData = {};
        if (config_value !== undefined) updateData.config_value = config_value;
        if (enabled !== undefined) updateData.enabled = enabled;

        await config.update(updateData);

        return res.json({
            message: 'Configuración actualizada',
            config
        });

    } catch (error) {
        console.error('[Kick Points Config] Error actualizando configuración:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Actualiza múltiples configuraciones a la vez
 */
exports.updateMultipleConfigs = async (req, res) => {
    try {
        const { configs } = req.body;

        if (!Array.isArray(configs)) {
            return res.status(400).json({ error: 'configs debe ser un array' });
        }

        const updated = [];

        for (const configData of configs) {
            const { config_key, config_value, enabled } = configData;

            if (!config_key) continue;

            const config = await KickPointsConfig.findOne({
                where: { config_key }
            });

            if (config) {
                const updateData = {};
                if (config_value !== undefined) updateData.config_value = config_value;
                if (enabled !== undefined) updateData.enabled = enabled;

                await config.update(updateData);
                updated.push(config);
            }
        }

        return res.json({
            message: `${updated.length} configuraciones actualizadas`,
            configs: updated
        });

    } catch (error) {
        console.error('[Kick Points Config] Error actualizando configuraciones:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Inicializa la configuración con valores por defecto
 */
exports.initializeConfig = async (req, res) => {
    try {
        const defaultConfigs = [
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

        const created = [];

        for (const configData of defaultConfigs) {
            const [config, isCreated] = await KickPointsConfig.findOrCreate({
                where: { config_key: configData.config_key },
                defaults: configData
            });

            if (isCreated) {
                created.push(config);
            }
        }

        return res.json({
            message: `Configuración inicializada (${created.length} nuevos, ${defaultConfigs.length - created.length} existentes)`,
            created,
            total: defaultConfigs.length
        });

    } catch (error) {
        console.error('[Kick Points Config] Error inicializando configuración:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
