const router = require('express').Router();
const authCtrl = require('../controllers/auth.controller');

// Auth local
router.post('/register', authCtrl.registerLocal);
router.post('/login',    authCtrl.loginLocal);

// Refresh token y logout
router.post('/refresh', authCtrl.refreshToken);
router.post('/logout', authCtrl.logout);
router.post('/logout-all', authCtrl.logoutAll);

// OAuth de Kick
router.get('/kick',      authCtrl.redirectKick);
router.get('/kick-callback', authCtrl.callbackKick);
router.post('/store-tokens', authCtrl.storeTokens);

// OAuth de Kick - BOT
router.get('/kick-bot', authCtrl.redirectKickBot);
router.get('/kick-bot-callback', authCtrl.callbackKickBot);

// OAuth de Discord
router.get('/discord', authCtrl.redirectDiscord);
router.get('/discord/callback', authCtrl.callbackDiscord);
router.post('/discord/link', authCtrl.linkDiscordManual);

// Debugging de cookies
router.get('/cookie-status', authCtrl.cookieStatus);

module.exports = router;
