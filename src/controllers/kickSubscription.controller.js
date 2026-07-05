const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription } = require('../models');
const logger = require('../utils/logger');

/**
 * Gets all Kick event subscriptions
 */
exports.getSubscriptions = async (req, res) => {
    try {
        const { authorization } = req.headers;

        if (!authorization) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authorization
            },
            timeout: 10000
        });

        // Also fetch locally stored subscriptions
        const localSubscriptions = await KickEventSubscription.findAll({
            where: { status: 'active' },
            order: [['created_at', 'DESC']]
        });

        return res.json({
            kick_subscriptions: response.data.data || [],
            local_subscriptions: localSubscriptions,
            message: response.data.message
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error fetching subscriptions:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error fetching Kick subscriptions',
                message: error.response.data?.message || 'Unknown error'
            });
        }

        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Creates new Kick event subscriptions
 */
exports.createSubscriptions = async (req, res) => {
    // Subscription methods allowed by the Kick API
    const ALLOWED_METHODS = ['webhook', 'websocket'];

    try {
        const { authorization } = req.headers;
        const { broadcaster_user_id, events, method = 'webhook' } = req.body;

        if (!authorization) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        if (!broadcaster_user_id || !events || !Array.isArray(events)) {
            return res.status(400).json({
                error: 'broadcaster_user_id and events (array) are required'
            });
        }

        // Validate that method is an allowed value (prevent SSRF / injection)
        const sanitizedMethod = ALLOWED_METHODS.includes(method) ? method : 'webhook';

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id,
            events,
            method: sanitizedMethod
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        // Store successful subscriptions in the local database
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    const localSub = await KickEventSubscription.create({
                        subscription_id: sub.subscription_id,
                        broadcaster_user_id,
                        event_type: sub.name,
                        event_version: sub.version,
                        method: sanitizedMethod,
                        status: 'active'
                    });
                    createdSubscriptions.push(localSub);
                } catch (dbError) {
                    logger.error('[Kick Subscription] Error saving subscription locally:', dbError.message);
                }
            }
        }

        return res.status(200).json({
            kick_response: response.data,
            local_subscriptions: createdSubscriptions,
            message: 'Subscriptions created successfully'
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error creating subscriptions:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error creating subscriptions in Kick',
                message: error.response.data?.message || 'Unknown error'
            });
        }

        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Deletes Kick event subscriptions
 */
exports.deleteSubscriptions = async (req, res) => {
    try {
        const { authorization } = req.headers;
        const { id } = req.query; // Can be an array or a string

        if (!authorization) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        if (!id) {
            return res.status(400).json({ error: 'Subscription ID(s) required' });
        }

        const ids = Array.isArray(id) ? id : [id];
        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        // Build query string with multiple IDs
        const queryParams = ids.map(subId => `id=${encodeURIComponent(subId)}`).join('&');

        const response = await axios.delete(`${apiUrl}?${queryParams}`, {
            headers: {
                'Authorization': authorization
            },
            timeout: 10000
        });

        // Delete or mark local subscriptions as inactive
        await KickEventSubscription.update(
            { status: 'inactive' },
            { where: { subscription_id: ids } }
        );

        return res.status(204).json({
            message: 'Subscriptions deleted successfully',
            data: response.data
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error deleting subscriptions:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error deleting Kick subscriptions',
                message: error.response.data?.message || 'Unknown error'
            });
        }

        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Gets all locally stored subscriptions
 */
exports.getLocalSubscriptions = async (req, res) => {
    try {
        const { status, event_type } = req.query;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (event_type) whereClause.event_type = event_type;

        const subscriptions = await KickEventSubscription.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']]
        });

        return res.json({
            subscriptions,
            total: subscriptions.length
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error fetching local subscriptions:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
