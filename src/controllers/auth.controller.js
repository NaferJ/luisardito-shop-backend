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
        const { code } = req.query;
        // 1. Intercambio de código por token
        const tokenRes = await axios.post('https://kick.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id:     config.kick.clientId,
            client_secret: config.kick.clientSecret,
            redirect_uri:  config.kick.redirectUri,
            code
        });
        const { access_token } = tokenRes.data;
        // 2. Obtener datos de usuario
        const userRes = await axios.get('https://api.kick.com/v1/users/me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const { id: userIdExt, username: nickname, avatar_url } = userRes.data;
        // 3. Crear o actualizar usuario local
        let user = await Usuario.findOne({ where: { user_id_ext: userIdExt } });
        if (!user) {
            const tempPass = Math.random().toString(36).slice(-8);
            const hash = await bcrypt.hash(tempPass, 10);
            user = await Usuario.create({
                user_id_ext:    userIdExt,
                nickname,
                password_hash:  hash,
                kick_data:      { avatar_url }
            });
            // Opcional: notificar contraseña temporal
        } else {
            await user.update({ kick_data: { avatar_url } });
        }
        // 4. Generar JWT
        const token = jwt.sign(
            { userId: user.id, rolId: user.rol_id },
            config.jwtSecret,
            { expiresIn: '7d' }
        );
        res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
