const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const https  = require('https');
const config = require('../../config');
const { Usuario } = require('../models');
const { generatePkce } = require('../utils/pkce.util');

// Registro local
exports.registerLocal = async (req, res) => {
    try {
        const { nickname, email, password } = req.body;
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
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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
        console.log('[Kick OAuth] code_verifier:', code_verifier);
        console.log('[Kick OAuth] code_challenge:', code_challenge);

        const statePayload = {
            cv: code_verifier,
            ruri: config.kick.redirectUri,
            iat: Math.floor(Date.now() / 1000)
        };
        // Firmamos el state para evitar manipulación y para transportar el code_verifier de forma segura
        const state = jwt.sign(statePayload, config.jwtSecret, { expiresIn: '10m' });

        console.log('[Kick OAuth] statePayload:', statePayload);
        console.log('[Kick OAuth] state (JWT):', state);

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
        console.log('[Kick OAuth] Redirect URL:', url);
        return res.redirect(url);
    } catch (err) {
        console.error('Error en redirectKick:', err?.message || err);
        return res.status(500).json({ error: 'No se pudo iniciar el flujo OAuth con Kick' });
    }
};

// Callback de Kick OAuth
exports.callbackKick = async (req, res) => {
    try {
        // OAuth estándar entrega code/state por query (GET)
        const { code, state } = req.query || {};
        console.log('[Kick OAuth] callbackKick req.query:', req.query);

        if (!code || !state) {
            console.log('[Kick OAuth] Faltan parámetros code/state:', { code, state });
            return res.status(400).json({ error: 'Faltan parámetros code/state' });
        }

        // Recuperar code_verifier desde el state firmado
        let decoded;
        try {
            decoded = jwt.verify(String(state), config.jwtSecret);
            console.log('[Kick OAuth] Decoded state:', decoded);
        } catch (e) {
            console.log('[Kick OAuth] state inválido o expirado:', e?.message || e);
            return res.status(400).json({ error: 'state inválido o expirado' });
        }

        const code_verifier = decoded?.cv;
        const finalRedirectUri = decoded?.ruri || config.kick.redirectUri;
        console.log('[Kick OAuth] code_verifier:', code_verifier);
        console.log('[Kick OAuth] finalRedirectUri:', finalRedirectUri);

        if (!code_verifier || !finalRedirectUri) {
            console.log('[Kick OAuth] PKCE o redirect_uri inválidos:', { code_verifier, finalRedirectUri });
            return res.status(400).json({ error: 'PKCE o redirect_uri inválidos' });
        }

        const tokenUrl = config.kick.oauthToken;
        const clientId = config.kick.clientId;
        const clientSecret = config.kick.clientSecret;

        console.log('[Kick OAuth] tokenUrl:', tokenUrl);
        console.log('[Kick OAuth] clientId:', clientId);
        console.log('[Kick OAuth] clientSecret:', clientSecret);

        if (!clientId || !clientSecret) {
            console.error('Falta configuración KICK_CLIENT_ID/KICK_CLIENT_SECRET');
            return res.status(500).json({ error: 'Configuración del proveedor incompleta' });
        }

        // Intercambio de código por token
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: finalRedirectUri,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier
        });

        console.log('[Kick OAuth] Token exchange params:', params.toString());

        const tokenRes = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        console.log('[Kick OAuth] tokenRes.data:', tokenRes.data);

        const tokenData = tokenRes.data;

        // Obtener datos del usuario en el API público
        const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
        const userUrl = `${userApiBase}/v1/user`;
        console.log('[Kick OAuth] userUrl:', userUrl);

        const userRes = await axios.get(userUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
            timeout: 10000
        });

        console.log('[Kick OAuth] userRes.data:', userRes.data);

        const kickUser = userRes.data;

        // Upsert de usuario local
        let usuario = await Usuario.findOne({ where: { user_id_ext: String(kickUser.id) } });
        let isNewUser = false;

        if (!usuario) {
            usuario = await Usuario.create({
                nickname: kickUser.username,
                email: kickUser.email || `${kickUser.username}@kick.user`,
                puntos: 1000,
                rol_id: 2,
                user_id_ext: String(kickUser.id),
                password_hash: null,
                kick_data: {
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username
                }
            });
            isNewUser = true;
            console.log('[Kick OAuth] Usuario creado:', usuario.id);
        } else {
            await usuario.update({
                kick_data: {
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username
                }
            });
            console.log('[Kick OAuth] Usuario actualizado:', usuario.id);
        }

        // Emitir nuestro JWT
        const token = jwt.sign({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: kickUser.id
        }, config.jwtSecret, { expiresIn: '24h' });

        console.log('[Kick OAuth] JWT emitido:', token);

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
                username: kickUser.username,
                id: kickUser.id,
                avatar_url: kickUser.avatar_url
            }
        });

    } catch (error) {
        console.error('Error en callback de Kick:', error?.message || error);

        if (error.response) {
            console.log('[Kick OAuth] error.response.data:', error.response.data);
            return res.status(error.response.status).json({
                error: 'Error al comunicarse con Kick',
                provider_status: error.response.status,
                details: error.response.data
            });
        }

        return res.status(502).json({ error: 'Fallo de red con el proveedor' });
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
        const userUrl = `${userApiBase}/v1/user`;

        // Obtener datos de usuario con el access token recibido
        const userRes = await axios.get(userUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            timeout: 10000
        });

        const kickUser = userRes.data;

        // Upsert de usuario local
        let usuario = await Usuario.findOne({ where: { user_id_ext: String(kickUser.id) } });
        let isNewUser = false;
        if (!usuario) {
            usuario = await Usuario.create({
                nickname: kickUser.username,
                email: kickUser.email || `${kickUser.username}@kick.user`,
                puntos: 1000,
                rol_id: 2,
                user_id_ext: String(kickUser.id),
                password_hash: null,
                kick_data: {
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username
                }
            });
            isNewUser = true;
        } else {
            await usuario.update({
                kick_data: {
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username
                }
            });
        }

        // Emitir nuestro JWT
        const token = jwt.sign({
            userId: usuario.id,
            rolId: usuario.rol_id,
            nickname: usuario.nickname,
            kick_id: kickUser.id
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
            // opcionalmente devolver lo que el frontend nos pasó
            provider: {
                accessTokenExpiresIn: expiresIn,
                hasRefreshToken: !!refreshToken
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
