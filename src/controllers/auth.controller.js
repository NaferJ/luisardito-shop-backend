const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const https  = require('https');
const config = require('../../config');
const { Usuario, KickBroadcasterToken, sequelize, DiscordUserLink } = require('../models');
const { generatePkce } = require('../utils/pkce.util');
const { getKickUserData } = require('../utils/kickApi');
const { Op } = require('sequelize');
const { autoSubscribeToEvents } = require('../services/kickAutoSubscribe.service');
const { uploadKickAvatarToCloudinary } = require('../utils/uploadAvatar');
const { extractAvatarUrl } = require('../utils/kickApi');
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies.util');
const KickBotTokenService = require('../services/kickBotToken.service');
const logger = require('../utils/logger');
const {
    generateAccessToken,
    createRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    rotateRefreshToken
} = require('../services/tokenService');

/**
 * Procesa el avatar de Kick y lo sube a Cloudinary
 * @param {Object} kickUser - Datos del usuario de Kick
 * @param {number} userId - ID del usuario en nuestra BD
 * @returns {Promise<string|null>} - URL de Cloudinary o null si falla
 */
async function processKickAvatar(kickUser, userId) {
    try {
        const kickAvatarUrl = extractAvatarUrl(kickUser);

        if (!kickAvatarUrl) {
            logger.info(`[Auth] No se encontró avatar para usuario ${userId}`);
            return null;
        }

        logger.info(`[Auth] Procesando avatar de Kick para usuario ${userId}:`, kickAvatarUrl);

        const cloudinaryUrl = await uploadKickAvatarToCloudinary(kickAvatarUrl, userId);

        logger.info(`[Auth] ✅ Avatar procesado exitosamente:`, cloudinaryUrl);
        return cloudinaryUrl;

    } catch (error) {
        logger.warn(`[Auth] Error procesando avatar para usuario ${userId}, continuando sin él:`, error.message);
        // No fallar el proceso de autenticación por problemas con el avatar
        return null;
    }
}

exports.registerLocal = async (req, res) => {
    try {
        let { nickname, email, password } = req.body;

        if (!nickname || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        nickname = nickname.trim().toLowerCase();
        email = email.trim().toLowerCase();

        const developers = ['naferjml@gmail.com'];
        if (!developers.includes(email)) {
            return res.status(403).json({ error: 'Registro manual solo para desarrolladores' });
        }

        // Verificar duplicados
        const existe = await Usuario.findOne({
            where: { [Op.or]: [{ nickname }, { email }] }
        });
        if (existe) {
            return res.status(409).json({ error: 'El nickname o email ya están registrados' });
        }

        const hash = await bcrypt.hash(password, 10);
        const user = await Usuario.create({ nickname, email, password_hash: hash });
        res.status(201).json({ message: 'Usuario creado', userId: user.id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Login local
exports.loginLocal = async (req, res) => {
    try {
        const { nickname, password } = req.body;
        const user = await Usuario.findOne({ where: { nickname } });
        if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar access token y refresh token
        const accessToken = generateAccessToken({
            userId: user.id,
            rolId: user.rol_id,
            nickname: user.nickname
        });

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const refreshToken = await createRefreshToken(user.id, ipAddress, userAgent);

        // Configurar cookies cross-domain
        setAuthCookies(res, accessToken, refreshToken.token);

        res.json({
            accessToken,
            refreshToken: refreshToken.token,
            expiresIn: 3600, // 1 hora en segundos
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email,
                puntos: user.puntos,
                rol_id: user.rol_id
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Redirect a Kick OAuth
exports.redirectKick = (req, res) => {
    try {
        const { code_verifier, code_challenge } = generatePkce();
        logger.info('[Kick OAuth][redirectKick] code_verifier:', code_verifier);
        logger.info('[Kick OAuth][redirectKick] code_challenge:', code_challenge);

        const statePayload = {
            cv: code_verifier,
            ruri: config.kick.redirectUri,
            iat: Math.floor(Date.now() / 1000)
        };
        const state = jwt.sign(statePayload, config.jwtSecret, { expiresIn: '10m' });

        logger.info('[Kick OAuth][redirectKick] statePayload:', statePayload);
        logger.info('[Kick OAuth][redirectKick] state (JWT):', state);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: String(config.kick.clientId || ''),
            redirect_uri: String(config.kick.redirectUri || ''),
            scope: 'user:read events:subscribe kicks:read',
            code_challenge: code_challenge,
            code_challenge_method: 'S256',
            state
        });

        const url = `${config.kick.oauthAuthorize}?${params.toString()}`;
        logger.info('[Kick OAuth][redirectKick] URL de redirección final:', url);
        return res.redirect(url);
    } catch (err) {
        logger.error('[Kick OAuth][redirectKick] Error:', err?.message || err);
        return res.status(500).json({ error: 'No se pudo iniciar el flujo OAuth con Kick' });
    }
};

// Redirect a Kick OAuth (BOT)
exports.redirectKickBot = (req, res) => {
    try {
        const { code_verifier, code_challenge } = generatePkce();

        const statePayload = {
            cv: code_verifier,
            ruri: config.kickBot.redirectUri,
            iat: Math.floor(Date.now() / 1000)
        };
        const state = jwt.sign(statePayload, config.jwtSecret, { expiresIn: '10m' });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: String(config.kickBot.clientId || ''),
            redirect_uri: String(config.kickBot.redirectUri || ''),
            scope: 'user:read chat:write channel:read channel:write',
            code_challenge: code_challenge,
            code_challenge_method: 'S256',
            state
        });

        const url = `${config.kick.oauthAuthorize}?${params.toString()}`;
        return res.redirect(url);
    } catch (err) {
        logger.error('[Kick OAuth][redirectKickBot] Error:', err?.message || err);
        return res.status(500).json({ error: 'No se pudo iniciar el flujo OAuth del BOT' });
    }
};

// Callback de Kick OAuth
exports.callbackKick = async (req, res) => {
    try {
        const { code, state } = req.query || {};
        logger.info('[Kick OAuth][callbackKick] Parámetros recibidos:', { code, state });

        if (!code || !state) {
            logger.info('[Kick OAuth][callbackKick] Faltan parámetros code/state:', { code, state });
            return res.status(400).json({ error: 'Faltan parámetros code/state' });
        }

        let decoded;
        try {
            decoded = jwt.verify(String(state), config.jwtSecret);
            logger.info('[Kick OAuth][callbackKick] State decodificado:', decoded);
        } catch (e) {
            logger.info('[Kick OAuth][callbackKick] State inválido o expirado:', e?.message || e);
            return res.status(400).json({ error: 'state inválido o expirado' });
        }

        const code_verifier = decoded?.cv;
        const finalRedirectUri = decoded?.ruri || config.kick.redirectUri;
        logger.info('[Kick OAuth][callbackKick] code_verifier recuperado:', code_verifier);
        logger.info('[Kick OAuth][callbackKick] finalRedirectUri:', finalRedirectUri);

        if (!code_verifier || !finalRedirectUri) {
            logger.info('[Kick OAuth][callbackKick] PKCE o redirect_uri inválidos:', { code_verifier, finalRedirectUri });
            return res.status(400).json({ error: 'PKCE o redirect_uri inválidos' });
        }

        const tokenUrl = config.kick.oauthToken;
        const clientId = config.kick.clientId;
        const clientSecret = config.kick.clientSecret;

        logger.info('[Kick OAuth][callbackKick] tokenUrl:', tokenUrl);
        logger.info('[Kick OAuth][callbackKick] clientId:', clientId);
        logger.info('[Kick OAuth][callbackKick] clientSecret:', clientSecret);

        if (!clientId || !clientSecret) {
            logger.error('[Kick OAuth][callbackKick] Falta configuración KICK_CLIENT_ID/KICK_CLIENT_SECRET');
            return res.status(500).json({ error: 'Configuración del proveedor incompleta' });
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: finalRedirectUri,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier
        });

        logger.info('[Kick OAuth][callbackKick] Parámetros enviados a token endpoint:', params.toString());

        const tokenRes = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        logger.info('[Kick OAuth][callbackKick] Respuesta de token endpoint:', tokenRes.data);

        const tokenData = tokenRes.data;

        const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
        const userUrl = `${userApiBase}/public/v1/users`;
        logger.info('[Kick OAuth][callbackKick] URL para obtener perfil de usuario:', userUrl);

        const userRes = await axios.get(userUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
            timeout: 10000
        });

        logger.info('[Kick OAuth][callbackKick] Respuesta de perfil de usuario:', userRes.data);

        const kickUser = Array.isArray(userRes.data.data) ? userRes.data.data[0] : userRes.data;

        // Primero buscar por user_id_ext (usuario ya vinculado)
        let usuario = await Usuario.findOne({ where: { user_id_ext: String(kickUser.user_id) } });
        let isNewUser = false;

        if (!usuario) {
            // Si no existe, buscar por nickname (case-insensitive) o email
            const colision = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        { email: kickUser.email },
                        { nickname: kickUser.name },
                        // Búsqueda case-insensitive para nickname
                        sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('nickname')),
                            sequelize.fn('LOWER', kickUser.name)
                        )
                    ]
                }
            });

            if (colision) {
                logger.info('[Kick OAuth][callbackKick] Colisión detectada, vinculando usuario existente:', {
                    usuario_id: colision.id,
                    usuario_nickname: colision.nickname,
                    kick_nickname: kickUser.name,
                    kick_email: kickUser.email,
                    kick_user_id: kickUser.user_id
                });

                // Vincular el user_id_ext al usuario existente
                // Procesar avatar con Cloudinary
                const cloudinaryAvatarUrl = await processKickAvatar(kickUser, colision.id);

                await colision.update({
                    user_id_ext: String(kickUser.user_id),
                    nickname: kickUser.name, // Actualizar con el nombre exacto de Kick
                    email: kickUser.email || colision.email, // Actualizar email si viene de Kick
                    kick_data: {
                        avatar_url: cloudinaryAvatarUrl || kickUser.profile_picture, // Cloudinary URL o fallback
                        username: kickUser.name
                    }
                });

                usuario = colision;
                isNewUser = false;
            } else {
                // Crear nuevo usuario
                // Primero crear el usuario para obtener el ID
                const newUserData = {
                    nickname: kickUser.name,
                    email: kickUser.email || `${kickUser.name}@kick.user`,
                    puntos: 1000,
                    rol_id: 1, // Usuarios nuevos empiezan como "usuario básico"
                    user_id_ext: String(kickUser.user_id),
                    password_hash: null,
                    kick_data: {
                        avatar_url: kickUser.profile_picture, // Temporal
                        username: kickUser.name
                    }
                };

                logger.info('[Kick OAuth][callbackKick] Datos a crear usuario:', newUserData);

                usuario = await Usuario.create(newUserData);

                // Procesar avatar con Cloudinary después de crear el usuario
                const cloudinaryAvatarUrl = await processKickAvatar(kickUser, usuario.id);

                if (cloudinaryAvatarUrl) {
                    await usuario.update({
                        kick_data: {
                            avatar_url: cloudinaryAvatarUrl,
                            username: kickUser.name
                        }
                    });
                }

                isNewUser = true;
                logger.info('[Kick OAuth][callbackKick] Usuario creado:', usuario.id);
            }
        } else {
            const colision = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        { email: kickUser.email },
                        { nickname: kickUser.name }
                    ],
                    id: { [Op.ne]: usuario.id }
                }
            });
            if (colision) {
                return res.status(409).json({ error: 'El email o nickname ya están en uso por otro usuario.' });
            }

            // Log de datos antes de actualizar usuario
            logger.info('[Kick OAuth][callbackKick] Datos a actualizar usuario:', {
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: kickUser.profile_picture,
                    username: kickUser.name
                }
            });

            // Procesar avatar con Cloudinary
            const cloudinaryAvatarUrl = await processKickAvatar(kickUser, usuario.id);

            await usuario.update({
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: cloudinaryAvatarUrl || kickUser.profile_picture, // Cloudinary URL o fallback
                    username: kickUser.name
                }
            });
            logger.info('[Kick OAuth][callbackKick] Usuario actualizado:', usuario.id);
        }

        // Guardar token del broadcaster y auto-suscribirse a eventos
        const kickUserId = String(kickUser.user_id);
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token || null;
        const expiresIn = tokenData.expires_in || null;

        let tokenExpiresAt = null;
        if (expiresIn) {
            tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        }

        // 🎯 DETECCIÓN AUTOMÁTICA: ¿Es el broadcaster principal?
        const isBroadcasterPrincipal = kickUserId === config.kick.broadcasterId;

        if (isBroadcasterPrincipal) {
            logger.info('🚀 [BROADCASTER PRINCIPAL] Luisardito autenticado - Configurando webhooks...');
        }

        // Guardar o actualizar token
        const [broadcasterToken, created] = await KickBroadcasterToken.findOrCreate({
            where: { kick_user_id: kickUserId },
            defaults: {
                kick_user_id: kickUserId,
                kick_username: kickUser.name,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: tokenExpiresAt,
                is_active: true,
                auto_subscribed: false
            }
        });

        if (!created) {
            await broadcasterToken.update({
                kick_username: kickUser.name,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: tokenExpiresAt,
                is_active: true
            });
        }

        logger.info('[Kick OAuth][callbackKick] Token guardado:', created ? 'nuevo' : 'actualizado');

        let autoSubscribeResult = null;

        // SOLO el broadcaster principal debe suscribirse a eventos
        if (isBroadcasterPrincipal) {
            logger.info('🚀 [BROADCASTER PRINCIPAL] Configurando suscripciones de webhooks...');

            try {
                // Usar SU PROPIO token para suscribirse a eventos de SU canal
                autoSubscribeResult = await autoSubscribeToEvents(accessToken, kickUserId, kickUserId);

                await broadcasterToken.update({
                    auto_subscribed: autoSubscribeResult.success,
                    last_subscription_attempt: new Date(),
                    subscription_error: autoSubscribeResult.success ? null : JSON.stringify(autoSubscribeResult.error)
                });

                if (autoSubscribeResult.success) {
                    logger.info(`🚀 [BROADCASTER PRINCIPAL] ✅ ${autoSubscribeResult.totalSubscribed} eventos configurados. Sistema listo.`);
                } else {
                    logger.error('🚀 [BROADCASTER PRINCIPAL] ❌ Error en configuración:', autoSubscribeResult.error);
                }
            } catch (subscribeError) {
                logger.error('🚀 [BROADCASTER PRINCIPAL] ❌ Error crítico:', subscribeError.message);
                await broadcasterToken.update({
                    auto_subscribed: false,
                    last_subscription_attempt: new Date(),
                    subscription_error: subscribeError.message
                });
            }
        } else {
            logger.info('👤 [Usuario Normal] Autenticado, no requiere configuración de webhooks');
        }

        // Generar access token y refresh token
        const jwtAccessToken = generateAccessToken({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: usuario.user_id
        });

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const refreshTokenObj = await createRefreshToken(usuario.id, ipAddress, userAgent);

        logger.info('[Kick OAuth][callbackKick] JWT emitido (access + refresh)');

        // Configurar cookies cross-domain
        setAuthCookies(res, jwtAccessToken, refreshTokenObj.token);

        const frontendUrl = config.frontendUrl || 'http://localhost:5173';
        const callbackData = {
            token: jwtAccessToken, // Retrocompatibilidad
            accessToken: jwtAccessToken,
            refreshToken: refreshTokenObj.token,
            expiresIn: 3600, // 1 hora en segundos
            usuario: {
                id: usuario.id,
                nickname: usuario.nickname,
                email: usuario.email,
                puntos: usuario.puntos,
                rol_id: usuario.rol_id,
                user_id_ext: usuario.user_id_ext,
                kick_data: usuario.kick_data,
                createdAt: usuario.createdAt,
                updatedAt: usuario.updatedAt
            },
            isNewUser,
            kickProfile: {
                username: kickUser.name,
                id: kickUser.user_id,
                avatar_url: kickUser.profile_picture
            },
            broadcasterConnected: true,
            autoSubscribed: autoSubscribeResult?.success || false,
            subscriptionInfo: autoSubscribeResult ? {
                totalSubscribed: autoSubscribeResult.totalSubscribed,
                totalErrors: autoSubscribeResult.totalErrors
            } : null
        };

        const encodedData = Buffer.from(JSON.stringify(callbackData)).toString('base64');
        const redirectUrl = `${frontendUrl}/auth/callback?data=${encodeURIComponent(encodedData)}`;

        logger.info('[Kick OAuth][callbackKick] Redirigiendo al frontend:', redirectUrl);

        return res.redirect(redirectUrl);

    } catch (error) {
        logger.error('[Kick OAuth][callbackKick] Error general:', error?.message || error);

        // Mostrar detalle de errores de validación de Sequelize si existen
        if (error.errors) {
            logger.error('[Kick OAuth][callbackKick] Detalle de errores de validación:', error.errors);
            // Responder con el mensaje de validación si es colisión de unicidad
            const uniqueError = error.errors.find(e => e.type === 'unique violation');
            if (uniqueError) {
                return res.status(409).json({ error: uniqueError.message, campo: uniqueError.path, valor: uniqueError.value });
            }
        }

        if (error.response) {
            logger.info('[Kick OAuth][callbackKick] error.response.data:', error.response.data);
            return res.status(error.response.status).json({
                error: 'Error al comunicarse con Kick',
                provider_status: error.response.status,
                details: error.response.data
            });
        }

        return res.status(502).json({
            error: 'Fallo de red con el proveedor',
            detalle: error.errors || error.message || error
        });
    }
};

// Callback de Kick OAuth (BOT)
exports.callbackKickBot = async (req, res) => {
    try {
        const { code, state } = req.query || {};
        logger.info('[Kick OAuth][callbackKickBot] Parámetros recibidos:', { code, state });

        if (!code || !state) {
            logger.info('[Kick OAuth][callbackKickBot] Faltan parámetros code/state');
            return res.status(400).json({ error: 'Faltan parámetros code/state' });
        }

        // Validar el estado
        let decodedState;
        try {
            decodedState = jwt.verify(state, config.jwtSecret);
            logger.info('[Kick OAuth][callbackKickBot] Estado decodificado:', decodedState);
        } catch (err) {
            logger.error('[Kick OAuth][callbackKickBot] Error al decodificar el estado:', err);
            return res.status(400).json({ error: 'Estado inválido o expirado' });
        }

        // Obtener tokens de acceso
        const tokenResponse = await axios.post(
            config.kick.oauthToken,
            new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: String(config.kickBot.clientId || ''),
                client_secret: String(config.kickBot.clientSecret || ''),
                code,
                redirect_uri: String(decodedState.ruri || ''),
                code_verifier: decodedState.cv
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

        // Obtener datos del bot
        const botUser = await getKickUserData(access_token);
        if (!botUser || !botUser.id) {
            throw new Error('No se pudieron obtener los datos del bot desde Kick');
        }

        // Guardar token del bot
        await KickBotTokenService.saveBotToken({
            kick_user_id: String(botUser.id),
            kick_username: String(botUser.username || `bot-${botUser.id}`),
            access_token,
            refresh_token,
            token_expires_at: tokenExpiresAt,
            scopes: ['user:read', 'chat:write', 'channel:read', 'channel:write']
        });

        // También guardar en tokens.json para auto-refresh
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const tokensFile = path.join(__dirname, '../../tokens/tokens.json');
            const fullPath = path.resolve(tokensFile);
            logger.info('[Kick OAuth][callbackKickBot] 📁 Guardando tokens en:', fullPath);
            const tokensForFile = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + (expires_in * 1000),
                refreshExpiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 año aprox
                username: String(botUser.username || `bot-${botUser.id}`)
            };
            await fs.writeFile(tokensFile, JSON.stringify(tokensForFile, null, 2));
            logger.info('[Kick OAuth][callbackKickBot] ✅ Tokens guardados en tokens.json');
        } catch (error) {
            logger.error('[Kick OAuth][callbackKickBot] ❌ Error guardando tokens.json:', error.message);
        }

        // Redirigir al frontend
        const frontendUrl = config.frontendUrl || 'http://localhost:5173';
        const message = encodeURIComponent('Bot conectado correctamente');
        return res.redirect(`${frontendUrl}/admin/integrations?kickBot=connected&msg=${message}`);
    } catch (err) {
        logger.error('[Kick OAuth][callbackKickBot] Error:', err);
        return res.status(500).json({ 
            error: 'Error en el callback de autenticación del bot',
            details: err.message 
        });
    }
};

// ...existing endpoints... (refreshToken, logout, logoutAll)

/**
 * Endpoint para refrescar el access token usando el refresh token
 */
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'refreshToken requerido' });
        }

        // Validar el refresh token
        const tokenRecord = await validateRefreshToken(refreshToken);

        if (!tokenRecord) {
            return res.status(401).json({ error: 'Refresh token inválido o expirado' });
        }

        // Obtener datos del usuario
        const usuario = await Usuario.findByPk(tokenRecord.usuario_id);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Rotar el refresh token (mayor seguridad)
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const newRefreshToken = await rotateRefreshToken(
            refreshToken,
            ipAddress,
            userAgent
        );

        // Generar nuevo access token
        const newAccessToken = generateAccessToken({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: usuario.user_id_ext
        });

        logger.info(`[Auth][refreshToken] Token renovado para usuario ${usuario.nickname}`);

        // Configurar cookies con los nuevos tokens
        setAuthCookies(res, newAccessToken, newRefreshToken.token);

        return res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken.token,
            expiresIn: 3600, // 1 hora en segundos
            user: {
                id: usuario.id,
                nickname: usuario.nickname,
                email: usuario.email,
                puntos: usuario.puntos,
                rol_id: usuario.rol_id
            }
        });

    } catch (error) {
        logger.error('[Auth][refreshToken] Error:', error.message);
        return res.status(500).json({ error: 'Error al refrescar token' });
    }
};

/**
 * Endpoint para cerrar sesión (revocar refresh token)
 */
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'refreshToken requerido' });
        }

        // Revocar el refresh token
        const revoked = await revokeRefreshToken(refreshToken);

        if (!revoked) {
            return res.status(404).json({ error: 'Refresh token no encontrado' });
        }

        // Limpiar cookies cross-domain
        clearAuthCookies(res);

        logger.info('[Auth][logout] Sesión cerrada exitosamente');

        return res.json({ message: 'Sesión cerrada exitosamente' });

    } catch (error) {
        logger.error('[Auth][logout] Error:', error.message);
        return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
};

/**
 * Endpoint para cerrar todas las sesiones de un usuario
 */
exports.logoutAll = async (req, res) => {
    try {
        // Obtener userId del token actual (asume middleware de autenticación)
        const { userId } = req.user || req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId requerido' });
        }

        // Revocar todos los refresh tokens del usuario
        const revokedCount = await revokeAllUserTokens(userId);

        // Limpiar cookies cross-domain
        clearAuthCookies(res);

        logger.info(`[Auth][logoutAll] ${revokedCount} sesiones cerradas para usuario ${userId}`);

        return res.json({
            message: `${revokedCount} sesión(es) cerrada(s) exitosamente`,
            revokedCount
        });

    } catch (error) {
        logger.error('[Auth][logoutAll] Error:', error.message);
        return res.status(500).json({ error: 'Error al cerrar sesiones' });
    }
};

// Recibir tokens desde el frontend (token exchange realizado en el navegador)
exports.storeTokens = async (req, res) => {
    try {
        const { accessToken, refreshToken, expiresIn } = req.body || {};
        if (!accessToken) {
            return res.status(400).json({ error: 'accessToken requerido' });
        }

        const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
        const userUrl = `${userApiBase}/public/v1/users`;

        // Obtener datos de usuario con el access token recibido
        const userRes = await axios.get(userUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            timeout: 10000
        });

        const kickUser = Array.isArray(userRes.data.data) ? userRes.data.data[0] : userRes.data;

        // Upsert de usuario local
        let usuario = await Usuario.findOne({ where: { user_id_ext: String(kickUser.user_id) } });
        let isNewUser = false;
        if (!usuario) {
            // Crear usuario nuevo
            const newUserData = {
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                puntos: 1000,
                rol_id: 1, // Usuarios nuevos empiezan como "usuario básico"
                user_id_ext: String(kickUser.user_id),
                password_hash: null,
                kick_data: {
                    avatar_url: kickUser.profile_picture, // Temporal
                    username: kickUser.name
                }
            };

            usuario = await Usuario.create(newUserData);

            // Procesar avatar con Cloudinary después de crear el usuario
            const cloudinaryAvatarUrl = await processKickAvatar(kickUser, usuario.id);

            if (cloudinaryAvatarUrl) {
                await usuario.update({
                    kick_data: {
                        avatar_url: cloudinaryAvatarUrl,
                        username: kickUser.name
                    }
                });
            }

            isNewUser = true;
        } else {
            // Procesar avatar con Cloudinary
            const cloudinaryAvatarUrl = await processKickAvatar(kickUser, usuario.id);

            await usuario.update({
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: cloudinaryAvatarUrl || kickUser.profile_picture, // Cloudinary URL o fallback
                    username: kickUser.name
                }
            });
        }

        // Emitir nuestro JWT
        const token = jwt.sign({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: kickUser.user_id
        }, config.jwtSecret, { expiresIn: '30d' });

        // Configurar cookies (aunque este endpoint se usa menos, por compatibilidad)
        setAuthCookies(res, token, 'no-refresh-token-provided');

        return res.json({
            token,
            usuario: {
                id: usuario.id,
                nickname: usuario.nickname,
                email: usuario.email,
                puntos: usuario.puntos,
                rol_id: usuario.rol_id,
                user_id_ext: usuario.user_id_ext,
                kick_data: usuario.kick_data,
                createdAt: usuario.createdAt,
                updatedAt: usuario.updatedAt
            },
            isNewUser,
            kickProfile: {
                username: kickUser.name,
                id: kickUser.user_id,
                avatar_url: kickUser.profile_picture
            }
        });
    } catch (error) {
        logger.error('Error en storeTokens:', error?.message || error);
        if (error.response) {
            return res.status(400).json({ error: 'Error al obtener perfil de Kick', details: error.response.data });
        }
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Endpoint para verificar el estado de las cookies (debugging)
 */
exports.cookieStatus = async (req, res) => {
    try {
        const cookies = req.headers.cookie;
        const authToken = req.cookies?.auth_token;
        const refreshToken = req.cookies?.refresh_token;

        return res.json({
            hasCookies: !!cookies,
            authToken: authToken ? 'presente' : 'ausente',
            refreshToken: refreshToken ? 'presente' : 'ausente',
            environment: process.env.NODE_ENV,
            domain: process.env.NODE_ENV === 'production' ? '.luisardito.com' : 'localhost',
            userAgent: req.headers['user-agent'],
            origin: req.headers.origin,
            allCookies: req.cookies
        });
    } catch (error) {
        logger.error('[Auth][cookieStatus] Error:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ==========================================
// 🎮 OAUTH DE DISCORD
// ==========================================

/**
 * Inicia el flujo OAuth de Discord
 */
exports.redirectDiscord = (req, res) => {
    try {
        logger.info('[Discord OAuth][redirectDiscord] Iniciando flujo OAuth de Discord');

        // Verificar que el usuario esté autenticado
        const userId = req.user?.userId;
        if (!userId) {
            logger.warn('[Discord OAuth][redirectDiscord] Usuario no autenticado');
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const { code_verifier, code_challenge } = generatePkce();
        logger.info('[Discord OAuth][redirectDiscord] code_verifier generado');

        const statePayload = {
            cv: code_verifier,
            ruri: config.discord.redirectUri,
            userId: userId,
            iat: Math.floor(Date.now() / 1000)
        };
        const state = jwt.sign(statePayload, config.jwtSecret, { expiresIn: '10m' });

        logger.info('[Discord OAuth][redirectDiscord] state creado para userId:', userId);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: String(config.discord.clientId || ''),
            redirect_uri: String(config.discord.redirectUri || ''),
            scope: 'identify guilds.join',
            code_challenge: code_challenge,
            code_challenge_method: 'S256',
            state
        });

        const url = `${config.discord.oauthAuthorize}?${params.toString()}`;
        logger.info('[Discord OAuth][redirectDiscord] URL de redirección:', url);

        return res.redirect(url);
    } catch (err) {
        logger.error('[Discord OAuth][redirectDiscord] Error:', err?.message || err);
        return res.status(500).json({ error: 'No se pudo iniciar el flujo OAuth con Discord' });
    }
};

/**
 * Callback del OAuth de Discord
 */
exports.callbackDiscord = async (req, res) => {
    try {
        const { code, state } = req.query || {};
        logger.info('[Discord OAuth][callbackDiscord] Parámetros recibidos:', { code, state });

        if (!code || !state) {
            logger.warn('[Discord OAuth][callbackDiscord] Faltan parámetros code/state');
            return res.status(400).json({ error: 'Faltan parámetros code/state' });
        }

        let decoded;
        try {
            decoded = jwt.verify(String(state), config.jwtSecret);
            logger.info('[Discord OAuth][callbackDiscord] State decodificado:', decoded);
        } catch (e) {
            logger.error('[Discord OAuth][callbackDiscord] State inválido o expirado:', e?.message || e);
            return res.status(400).json({ error: 'State inválido o expirado' });
        }

        const code_verifier = decoded?.cv;
        const finalRedirectUri = decoded?.ruri || config.discord.redirectUri;
        const userId = decoded?.userId;

        logger.info('[Discord OAuth][callbackDiscord] Datos extraídos:', {
            code_verifier: !!code_verifier,
            finalRedirectUri,
            userId
        });

        if (!code_verifier || !finalRedirectUri || !userId) {
            logger.error('[Discord OAuth][callbackDiscord] Datos inválidos en state');
            return res.status(400).json({ error: 'Datos inválidos en state' });
        }

        // Verificar que el usuario existe
        const usuario = await Usuario.findByPk(userId);
        if (!usuario) {
            logger.error('[Discord OAuth][callbackDiscord] Usuario no encontrado:', userId);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Intercambiar código por tokens
        const tokenUrl = config.discord.oauthToken;
        const clientId = config.discord.clientId;
        const clientSecret = config.discord.clientSecret;

        if (!clientId || !clientSecret) {
            logger.error('[Discord OAuth][callbackDiscord] Falta configuración DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET');
            return res.status(500).json({ error: 'Configuración del proveedor incompleta' });
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: finalRedirectUri,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier
        });

        logger.info('[Discord OAuth][callbackDiscord] Intercambiando código por tokens...');

        const tokenRes = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        const tokenData = tokenRes.data;
        logger.info('[Discord OAuth][callbackDiscord] Tokens obtenidos exitosamente');

        // Obtener información del usuario de Discord
        const userUrl = `${config.discord.apiBaseUrl}/users/@me`;
        const userRes = await axios.get(userUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
            timeout: 10000
        });

        const discordUser = userRes.data;
        logger.info('[Discord OAuth][callbackDiscord] Usuario de Discord obtenido:', {
            id: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator
        });

        // Verificar si ya existe una vinculación
        const existingLink = await DiscordUserLink.findOne({
            where: { discord_user_id: discordUser.id }
        });

        if (existingLink) {
            if (existingLink.tienda_user_id === userId) {
                logger.info('[Discord OAuth][callbackDiscord] Usuario ya vinculado, actualizando tokens');
                // Actualizar tokens
                await existingLink.update({
                    discord_username: discordUser.username,
                    discord_discriminator: discordUser.discriminator,
                    discord_avatar: discordUser.avatar,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token || null,
                    token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null
                });
            } else {
                logger.warn('[Discord OAuth][callbackDiscord] Discord ID ya vinculado a otro usuario');
                return res.status(409).json({ error: 'Esta cuenta de Discord ya está vinculada a otro usuario' });
            }
        } else {
            // Crear nueva vinculación
            logger.info('[Discord OAuth][callbackDiscord] Creando nueva vinculación');
            await DiscordUserLink.create({
                discord_user_id: discordUser.id,
                discord_username: discordUser.username,
                discord_discriminator: discordUser.discriminator,
                discord_avatar: discordUser.avatar,
                tienda_user_id: userId,
                kick_user_id: usuario.user_id_ext,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || null,
                token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null
            });
        }

        // Actualizar discord_username en el usuario si no lo tiene
        if (!usuario.discord_username) {
            await usuario.update({
                discord_username: `${discordUser.username}#${discordUser.discriminator}`
            });
        }

        logger.info('[Discord OAuth][callbackDiscord] Vinculación completada exitosamente');

        // Redirigir al frontend con éxito
        const frontendUrl = config.frontendUrl || 'https://luisardito.com';
        return res.redirect(`${frontendUrl}/perfil?discord_linked=success`);

    } catch (error) {
        logger.error('[Discord OAuth][callbackDiscord] Error:', error);
        const frontendUrl = config.frontendUrl || 'https://luisardito.com';
        return res.redirect(`${frontendUrl}/perfil?discord_linked=error`);
    }
};

/**
 * Vinculación manual de Discord (por código temporal)
 */
exports.linkDiscordManual = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        if (!code) {
            return res.status(400).json({ error: 'Código requerido' });
        }

        // Aquí implementaríamos la lógica de códigos temporales
        // Por ahora, devolver que no está implementado
        logger.info('[Discord OAuth][linkDiscordManual] Método no implementado aún');
        return res.status(501).json({ error: 'Método no implementado' });

    } catch (error) {
        logger.error('[Discord OAuth][linkDiscordManual] Error:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
