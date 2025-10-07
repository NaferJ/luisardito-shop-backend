const router = require('express').Router();
const authCtrl = require('../controllers/auth.controller');

router.post('/register', authCtrl.registerLocal);
router.post('/login',    authCtrl.loginLocal);

router.get('/kick',      authCtrl.redirectKick);
router.get('/kick-callback', authCtrl.callbackKick);
router.post('/store-tokens', authCtrl.storeTokens);

module.exports = router;
