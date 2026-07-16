import { Router } from "express";
import authCtrl from "../controllers/auth.controller";
import validate from "../middleware/validate.middleware";
import authRequired from "../middleware/authRequired.middleware";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from "../schemas/auth.schema";

const router = Router();

// Auth local
router.post("/register", validate(registerSchema), authCtrl.registerLocal);
router.post("/login", validate(loginSchema), authCtrl.loginLocal);

// Refresh token and logout
router.post("/refresh", validate(refreshSchema), authCtrl.refreshToken);
router.post("/logout", validate(logoutSchema), authCtrl.logout);
router.post("/logout-all", authCtrl.logoutAll);

// Kick OAuth
router.get("/kick", authCtrl.redirectKick);
router.get("/kick-callback", authCtrl.callbackKick);
router.post("/store-tokens", authCtrl.storeTokens);

// Kick OAuth - BOT
router.get("/kick-bot", authCtrl.redirectKickBot);
router.get("/kick-bot-callback", authCtrl.callbackKickBot);

// Discord OAuth
router.get("/discord", authRequired, authCtrl.redirectDiscord);
router.get("/discord/callback", authCtrl.callbackDiscord);
router.post("/discord/link", authRequired, authCtrl.linkDiscordManual);
router.post("/discord/unlink", authRequired, authCtrl.unlinkDiscord);

// Cookie debugging
router.get("/cookie-status", authCtrl.cookieStatus);

export = router;
