const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const https  = require('https');
const config = require('../../config');
const { Usuario } = require('../models');

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
    const url = `https://kick.com/oauth/authorize?response_type=code&client_id=${config.kick.clientId}&redirect_uri=${config.kick.redirectUri}&scope=user:read`;
    res.redirect(url);
};

// Callback de Kick OAuth
exports.callbackKick = async (req, res) => {
    try {
        const { code, redirect_uri, code_verifier } = req.body || {};

        if (!code) {
            return res.status(400).json({ error: 'Código de autorización requerido' });
        }
        if (!code_verifier) {
            return res.status(400).json({ error: 'Code verifier requerido para PKCE' });
        }
        const finalRedirectUri = redirect_uri || config.kick.redirectUri;
        if (!finalRedirectUri) {
            return res.status(400).json({ error: 'redirect_uri faltante' });
        }

        const tokenUrl = process.env.KICK_OAUTH_TOKEN_URL || 'https://kick.com/oauth/token';
        const userUrl = process.env.KICK_USER_API_URL || 'https://kick.com/api/v1/user';
        const clientId = process.env.KICK_CLIENT_ID || config.kick.clientId;

        if (!clientId) {
            console.error('Falta KICK_CLIENT_ID en variables de entorno/config');
            return res.status(500).json({ error: 'Configuración del proveedor incompleta (client_id)' });
        }

        console.log('Procesando callback de Kick con código:', code);
        console.log('PKCE code_verifier presente:', !!code_verifier);
        console.log('Usando tokenUrl:', tokenUrl);
        console.log('Usando userUrl:', userUrl);

        // 1. Intercambiar código por token de acceso (con PKCE)
        // Definiciones compartidas para ambos flujos (con y sin proxy)
        const httpsAgent = new https.Agent({
            // Preferir API moderna
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            // Lista de cifrados comunes en navegadores modernos
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
            honorCipherOrder: true
        });
        const browserLikeHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Origin': 'https://kick.com',
            'Referer': 'https://kick.com/'
        };
        // Intercambio directo a Kick con x-www-form-urlencoded y headers mínimos
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: finalRedirectUri,
            client_id: clientId,
            code_verifier
        });

        const tokenRes = await axios.post(tokenUrl, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            httpsAgent,
            timeout: 10000
        });

        const tokenData = tokenRes.data;
        console.log('Token obtenido de Kick: status', tokenRes.status);

        // 2. Obtener datos del usuario de Kick
        const userRes = await axios.get(userUrl, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${tokenData.access_token}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            httpsAgent,
            timeout: 10000
        });

        const kickUser = userRes.data;
        console.log('Datos de usuario obtenidos para:', kickUser?.username || kickUser?.id);

        // 3. Buscar usuario existente por user_id_ext (ID de Kick)
        let usuario = await Usuario.findOne({
            where: { user_id_ext: String(kickUser.id) }
        });

        let isNewUser = false;

        if (!usuario) {
            // Usuario nuevo, crear en base de datos
            console.log('Creando nuevo usuario para:', kickUser.username);

            usuario = await Usuario.create({
                nickname: kickUser.username,
                email: kickUser.email || `${kickUser.username}@kick.user`,
                puntos: 1000, // Puntos iniciales para usuarios de Kick
                rol_id: 2, // rol_id 2 para usuarios de Kick
                user_id_ext: String(kickUser.id),
                password_hash: null, // Sin password para usuarios OAuth
                kick_data: { 
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username 
                }
            });

            isNewUser = true;
            console.log('Usuario creado exitosamente:', usuario.nickname);
        } else {
            // Actualizar datos de Kick del usuario existente
            await usuario.update({ 
                kick_data: { 
                    avatar_url: kickUser.avatar_url,
                    username: kickUser.username 
                }
            });
            console.log('Usuario existente encontrado:', usuario.nickname);
        }

        // 4. Generar JWT para el usuario
        const token = jwt.sign(
            { 
                userId: usuario.id, 
                rolId: usuario.rol_id,
                nickname: usuario.nickname,
                kick_id: kickUser.id 
            },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        console.log(`${isNewUser ? 'Registro' : 'Login'} exitoso para:`, usuario.nickname);

        res.json({
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
            console.error('Error de API:', error.response.status, error.response.data);
            return res.status(error.response.status === 400 || error.response.status === 401 ? 400 : 502).json({
                error: 'Error al comunicarse con Kick',
                provider_status: error.response.status,
                details: error.response.data
            });
        }

        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Recibir tokens desde el frontend (token exchange realizado en el navegador)
exports.storeTokens = async (req, res) => {
    try {
        const { accessToken, refreshToken, expiresIn } = req.body || {};
        if (!accessToken) {
            return res.status(400).json({ error: 'accessToken requerido' });
        }

        const userUrl = process.env.KICK_USER_API_URL || 'https://kick.com/api/v1/user';
        const httpsAgent = new https.Agent({
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305',
            honorCipherOrder: true
        });
        const browserLikeHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Origin': 'https://kick.com',
            'Referer': 'https://kick.com/'
        };

        // Obtener datos de usuario con el access token recibido
        const userRes = await axios.get(userUrl, {
            headers: {
                ...browserLikeHeaders,
                'Authorization': `Bearer ${accessToken}`
            },
            httpsAgent,
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
