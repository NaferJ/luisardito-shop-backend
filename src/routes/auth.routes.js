const router = require('express').Router();
const authCtrl = require('../controllers/auth.controller');

router.post('/register', authCtrl.registerLocal);
router.post('/login',    authCtrl.loginLocal);

router.get('/kick',      authCtrl.redirectKick);
router.get('/kick-callback', authCtrl.callbackKick);
router.post('/store-tokens', authCtrl.storeTokens);

router.post('/kick/web', authCtrl.loginKickWeb);

router.get('/kick/validate', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const decoded = jwt.verify(token, config.jwtSecret);

        const usuario = await Usuario.findByPk(decoded.userId);
        if (!usuario?.kick_data?.session_cookies) {
            return res.status(401).json({ error: 'Sesión no válida' });
        }

        const isValid = await kickWebAuth.validateSession(usuario.kick_data.session_cookies);

        return res.json({ valid: isValid });
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;
