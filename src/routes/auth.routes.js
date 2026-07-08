const router = require("express").Router();
const authCtrl = require("../controllers/auth.controller");
const validate = require("../middleware/validate.middleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} = require("../schemas/auth.schema");

// Auth local
router.post("/register", validate(registerSchema), authCtrl.registerLocal);
router.post("/login", validate(loginSchema), authCtrl.loginLocal);

// Refresh token y logout
router.post("/refresh", validate(refreshSchema), authCtrl.refreshToken);
router.post("/logout", validate(logoutSchema), authCtrl.logout);
router.post("/logout-all", authCtrl.logoutAll);

// OAuth de Kick
router.get("/kick", authCtrl.redirectKick);
router.get("/kick-callback", authCtrl.callbackKick);
router.post("/store-tokens", authCtrl.storeTokens);

// OAuth de Kick - BOT
router.get("/kick-bot", authCtrl.redirectKickBot);
router.get("/kick-bot-callback", authCtrl.callbackKickBot);

const authRequired = require("../middleware/authRequired.middleware");

// OAuth de Discord
router.get("/discord", authRequired, authCtrl.redirectDiscord);
router.get("/discord/callback", authCtrl.callbackDiscord);
router.post("/discord/link", authRequired, authCtrl.linkDiscordManual);
router.post("/discord/unlink", authRequired, authCtrl.unlinkDiscord);

// Debugging de cookies
router.get("/cookie-status", authCtrl.cookieStatus);

module.exports = router;
