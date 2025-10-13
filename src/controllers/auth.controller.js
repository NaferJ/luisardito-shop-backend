const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const https  = require('https');
const config = require('../../config');
const { Usuario, KickBroadcasterToken, sequelize } = require('../models');
const { generatePkce } = require('../utils/pkce.util');
const { Op } = require('sequelize');
const { autoSubscribeToEvents } = require('../services/kickAutoSubscribe.service');
const {
    generateAccessToken,
    createRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    rotateRefreshToken
} = require('../services/tokenService');

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
        console.log('[Kick OAuth][redirectKick] code_verifier:', code_verifier);
        console.log('[Kick OAuth][redirectKick] code_challenge:', code_challenge);

        const statePayload = {
            cv: code_verifier,
            ruri: config.kick.redirectUri,
            iat: Math.floor(Date.now() / 1000)
        };
        const state = jwt.sign(statePayload, config.jwtSecret, { expiresIn: '10m' });

        console.log('[Kick OAuth][redirectKick] statePayload:', statePayload);
        console.log('[Kick OAuth][redirectKick] state (JWT):', state);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: String(config.kick.clientId || ''),
            redirect_uri: String(config.kick.redirectUri || ''),
            scope: 'user:read events:subscribe',
            code_challenge: code_challenge,
            code_challenge_method: 'S256',
            state
        });

        const url = `${config.kick.oauthAuthorize}?${params.toString()}`;
        console.log('[Kick OAuth][redirectKick] URL de redirección final:', url);
        return res.redirect(url);
    } catch (err) {
        console.error('[Kick OAuth][redirectKick] Error:', err?.message || err);
        return res.status(500).json({ error: 'No se pudo iniciar el flujo OAuth con Kick' });
    }
};

// Callback de Kick OAuth
exports.callbackKick = async (req, res) => {
    try {
        const { code, state } = req.query || {};
        console.log('[Kick OAuth][callbackKick] Parámetros recibidos:', { code, state });

        if (!code || !state) {
            console.log('[Kick OAuth][callbackKick] Faltan parámetros code/state:', { code, state });
            return res.status(400).json({ error: 'Faltan parámetros code/state' });
        }

        let decoded;
        try {
            decoded = jwt.verify(String(state), config.jwtSecret);
            console.log('[Kick OAuth][callbackKick] State decodificado:', decoded);
        } catch (e) {
            console.log('[Kick OAuth][callbackKick] State inválido o expirado:', e?.message || e);
            return res.status(400).json({ error: 'state inválido o expirado' });
        }

        const code_verifier = decoded?.cv;
        const finalRedirectUri = decoded?.ruri || config.kick.redirectUri;
        console.log('[Kick OAuth][callbackKick] code_verifier recuperado:', code_verifier);
        console.log('[Kick OAuth][callbackKick] finalRedirectUri:', finalRedirectUri);

        if (!code_verifier || !finalRedirectUri) {
            console.log('[Kick OAuth][callbackKick] PKCE o redirect_uri inválidos:', { code_verifier, finalRedirectUri });
            return res.status(400).json({ error: 'PKCE o redirect_uri inválidos' });
        }

        const tokenUrl = config.kick.oauthToken;
        const clientId = config.kick.clientId;
        const clientSecret = config.kick.clientSecret;

        console.log('[Kick OAuth][callbackKick] tokenUrl:', tokenUrl);
        console.log('[Kick OAuth][callbackKick] clientId:', clientId);
        console.log('[Kick OAuth][callbackKick] clientSecret:', clientSecret);

        if (!clientId || !clientSecret) {
            console.error('[Kick OAuth][callbackKick] Falta configuración KICK_CLIENT_ID/KICK_CLIENT_SECRET');
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

        console.log('[Kick OAuth][callbackKick] Parámetros enviados a token endpoint:', params.toString());

        const tokenRes = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        console.log('[Kick OAuth][callbackKick] Respuesta de token endpoint:', tokenRes.data);

        const tokenData = tokenRes.data;

        const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
        const userUrl = `${userApiBase}/public/v1/users`;
        console.log('[Kick OAuth][callbackKick] URL para obtener perfil de usuario:', userUrl);

        const userRes = await axios.get(userUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
            timeout: 10000
        });

        console.log('[Kick OAuth][callbackKick] Respuesta de perfil de usuario:', userRes.data);

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
                console.log('[Kick OAuth][callbackKick] Colisión detectada, vinculando usuario existente:', {
                    usuario_id: colision.id,
                    usuario_nickname: colision.nickname,
                    kick_nickname: kickUser.name,
                    kick_email: kickUser.email,
                    kick_user_id: kickUser.user_id
                });

                // Vincular el user_id_ext al usuario existente
                await colision.update({
                    user_id_ext: String(kickUser.user_id),
                    nickname: kickUser.name, // Actualizar con el nombre exacto de Kick
                    email: kickUser.email || colision.email, // Actualizar email si viene de Kick
                    kick_data: {
                        avatar_url: kickUser.profile_picture,
                        username: kickUser.name
                    }
                });

                usuario = colision;
                isNewUser = false;
            } else {
                console.log('[Kick OAuth][callbackKick] Datos a crear usuario:', {
                    nickname: kickUser.name,
                    email: kickUser.email || `${kickUser.name}@kick.user`,
                    puntos: 1000,
                    rol_id: 2,
                    user_id_ext: String(kickUser.user_id),
                    password_hash: null,
                    kick_data: {
                        avatar_url: kickUser.profile_picture,
                        username: kickUser.name
                    }
                });
                usuario = await Usuario.create({
                    nickname: kickUser.name,
                    email: kickUser.email || `${kickUser.name}@kick.user`,
                    puntos: 1000,
                    rol_id: 2,
                    user_id_ext: String(kickUser.user_id),
                    password_hash: null,
                    kick_data: {
                        avatar_url: kickUser.profile_picture,
                        username: kickUser.name
                    }
                });
                isNewUser = true;
                console.log('[Kick OAuth][callbackKick] Usuario creado:', usuario.id);
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
            console.log('[Kick OAuth][callbackKick] Datos a actualizar usuario:', {
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: kickUser.profile_picture,
                    username: kickUser.name
                }
            });

            await usuario.update({
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: kickUser.profile_picture,
                    username: kickUser.name
                }
            });
            console.log('[Kick OAuth][callbackKick] Usuario actualizado:', usuario.id);
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

        console.log('[Kick OAuth][callbackKick] Guardando token del broadcaster...');

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

        console.log('[Kick OAuth][callbackKick] Token guardado:', created ? 'nuevo' : 'actualizado');

        // Auto-suscribirse a eventos de Kick SOLO si es el broadcaster principal (Luisardito)
        const isBroadcaster = config.kick.broadcasterId &&
                             String(kickUserId) === String(config.kick.broadcasterId);

        console.log('[Kick OAuth][callbackKick] ¿Es broadcaster principal?', isBroadcaster,
                   `(user: ${kickUserId}, broadcaster: ${config.kick.broadcasterId})`);

        let autoSubscribeResult = null;

        if (isBroadcaster) {
            console.log('[Kick OAuth][callbackKick] Iniciando auto-suscripción a eventos...');

            try {
                autoSubscribeResult = await autoSubscribeToEvents(accessToken, kickUserId);

                await broadcasterToken.update({
                    auto_subscribed: autoSubscribeResult.success,
                    last_subscription_attempt: new Date(),
                    subscription_error: autoSubscribeResult.success ? null : JSON.stringify(autoSubscribeResult.error)
                });

                console.log('[Kick OAuth][callbackKick] Auto-suscripción:', autoSubscribeResult.success ? '✅ Exitosa' : '❌ Falló');
                if (autoSubscribeResult.success) {
                    console.log(`[Kick OAuth][callbackKick] ${autoSubscribeResult.totalSubscribed} eventos suscritos`);
                }
            } catch (subscribeError) {
                console.error('[Kick OAuth][callbackKick] Error en auto-suscripción:', subscribeError.message);
                await broadcasterToken.update({
                    auto_subscribed: false,
                    last_subscription_attempt: new Date(),
                    subscription_error: subscribeError.message
                });
            }
        } else {
            console.log('[Kick OAuth][callbackKick] Usuario no es broadcaster, saltando auto-suscripción');
        }

        // Generar access token y refresh token
        const jwtAccessToken = generateAccessToken({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: kickUser.user_id
        });

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const refreshTokenObj = await createRefreshToken(usuario.id, ipAddress, userAgent);

        console.log('[Kick OAuth][callbackKick] JWT emitido (access + refresh)');

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

        console.log('[Kick OAuth][callbackKick] Redirigiendo al frontend:', redirectUrl);

        return res.redirect(redirectUrl);

    } catch (error) {
        console.error('[Kick OAuth][callbackKick] Error general:', error?.message || error);

        // Mostrar detalle de errores de validación de Sequelize si existen
        if (error.errors) {
            console.error('[Kick OAuth][callbackKick] Detalle de errores de validación:', error.errors);
            // Responder con el mensaje de validación si es colisión de unicidad
            const uniqueError = error.errors.find(e => e.type === 'unique violation');
            if (uniqueError) {
                return res.status(409).json({ error: uniqueError.message, campo: uniqueError.path, valor: uniqueError.value });
            }
        }

        if (error.response) {
            console.log('[Kick OAuth][callbackKick] error.response.data:', error.response.data);
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

        console.log(`[Auth][refreshToken] Token renovado para usuario ${usuario.nickname}`);

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
        console.error('[Auth][refreshToken] Error:', error.message);
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

        console.log('[Auth][logout] Sesión cerrada exitosamente');

        return res.json({ message: 'Sesión cerrada exitosamente' });

    } catch (error) {
        console.error('[Auth][logout] Error:', error.message);
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

        console.log(`[Auth][logoutAll] ${revokedCount} sesiones cerradas para usuario ${userId}`);

        return res.json({
            message: `${revokedCount} sesión(es) cerrada(s) exitosamente`,
            revokedCount
        });

    } catch (error) {
        console.error('[Auth][logoutAll] Error:', error.message);
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
            usuario = await Usuario.create({
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                puntos: 1000,
                rol_id: 2,
                user_id_ext: String(kickUser.user_id),
                password_hash: null,
                kick_data: {
                    avatar_url: kickUser.profile_picture,
                    username: kickUser.name
                }
            });
            isNewUser = true;
        } else {
            await usuario.update({
                nickname: kickUser.name,
                email: kickUser.email || `${kickUser.name}@kick.user`,
                kick_data: {
                    avatar_url: kickUser.profile_picture,
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
        }, config.jwtSecret, { expiresIn: '24h' });

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
        console.error('Error en storeTokens:', error?.message || error);
        if (error.response) {
            return res.status(400).json({ error: 'Error al obtener perfil de Kick', details: error.response.data });
        }
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
