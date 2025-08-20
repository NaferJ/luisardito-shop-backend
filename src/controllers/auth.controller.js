const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
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
        const { code, redirect_uri, code_verifier } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Código de autorización requerido' });
        }

        if (!code_verifier) {
            return res.status(400).json({ error: 'Code verifier requerido para PKCE' });
        }

        console.log('Procesando callback de Kick con código:', code);
        console.log('PKCE code_verifier presente:', !!code_verifier);

        // 1. Intercambiar código por token de acceso (con PKCE)
        const tokenRes = await axios.post(process.env.KICK_OAUTH_TOKEN_URL, {
            client_id: process.env.KICK_CLIENT_ID,
            client_secret: process.env.KICK_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri,
            code_verifier: code_verifier
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const tokenData = tokenRes.data;
        console.log('Token obtenido de Kick');

        // 2. Obtener datos del usuario de Kick
        const userRes = await axios.get(process.env.KICK_USER_API_URL, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json'
            }
        });

        const kickUser = userRes.data;
        console.log('Datos de usuario obtenidos:', kickUser.username);

        // 3. Buscar usuario existente por user_id_ext (ID de Kick)
        let usuario = await Usuario.findOne({
            where: { user_id_ext: kickUser.id.toString() }
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
                user_id_ext: kickUser.id.toString(),
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
        console.error('Error en callback de Kick:', error);

        if (error.response) {
            console.error('Error de API:', error.response.status, error.response.data);
            return res.status(400).json({ 
                error: 'Error al comunicarse con Kick',
                details: error.response.data 
            });
        }

        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
