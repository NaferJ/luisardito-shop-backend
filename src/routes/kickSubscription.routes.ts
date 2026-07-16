import { Router } from "express";
import kickSubscriptionCtrl from "../controllers/kickSubscription.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = Router();

// Rutas protegidas - Todas requieren autenticación estricta + permisos

// Endpoints para gestionar suscripciones de eventos de Kick (protegidos para admins)
router.get(
  "/subscriptions",
  authRequired,
  permiso("ver_usuarios"),
  kickSubscriptionCtrl.getSubscriptions
);
router.post(
  "/subscriptions",
  authRequired,
  permiso("gestionar_usuarios"),
  kickSubscriptionCtrl.createSubscriptions
);
router.delete(
  "/subscriptions",
  authRequired,
  permiso("gestionar_usuarios"),
  kickSubscriptionCtrl.deleteSubscriptions
);

// Endpoints para consultar suscripciones almacenadas localmente (protegido para admins)
router.get(
  "/local-subscriptions",
  authRequired,
  permiso("ver_usuarios"),
  kickSubscriptionCtrl.getLocalSubscriptions
);

export = router;
