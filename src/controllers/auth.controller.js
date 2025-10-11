const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const https  = require('https');
const config = require('../../config');
const { Usuario } = require('../models');
const { generatePkce } = require('../utils/pkce.util');
const { Op } = require('sequelize');

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
        const token = jwt.sign(
            { userId: user.id, rolId: user.rol_id },
            config.jwtSecret,
            { expiresIn: '7d' }
        );
        res.json({ token });
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
            scope: 'user:read',
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

        let usuario = await Usuario.findOne({ where: { user_id_ext: String(kickUser.user_id) } });
        let isNewUser = false;

        if (!usuario) {
            // Verificar colisión ANTES de crear usuario
            const colision = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        { email: kickUser.email },
                        { nickname: kickUser.name }
                    ]
                }
            });
            if (colision) {
                console.log('[Kick OAuth][callbackKick] Colisión detectada, usando usuario existente:', {
                    email: kickUser.email,
                    nickname: kickUser.name
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

        const token = jwt.sign({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: kickUser.user_id
        }, config.jwtSecret, { expiresIn: '24h' });

        console.log('[Kick OAuth][callbackKick] JWT emitido:', token);

        const frontendUrl = config.frontendUrl || 'http://localhost:5173';
        const callbackData = {
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
