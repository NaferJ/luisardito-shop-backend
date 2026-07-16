import express from "express";
import kickRewardController from "../controllers/kickReward.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = express.Router();

/**
 * Rutas para gestión de recompensas de Kick
 * Todas las rutas requieren autenticación y permisos de administrador
 */

// Estadísticas de recompensas
router.get(
  "/stats",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.getRewardsStats
);

// Sincronizar recompensas desde Kick
router.post(
  "/sync",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.syncRewards
);

// Obtener todas las recompensas
router.get(
  "/",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.getAllRewards
);

// Obtener una recompensa por ID
router.get(
  "/:id",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.getRewardById
);

// Crear nueva recompensa en Kick
router.post(
  "/",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.createReward
);

// Actualizar recompensa completa
router.patch(
  "/:id",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.updateReward
);

// Actualizar solo puntos a otorgar (local)
router.patch(
  "/:id/points",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.updateRewardPoints
);

// Eliminar recompensa
router.delete(
  "/:id",
  authRequired,
  permiso("administrar_puntos"),
  kickRewardController.deleteReward
);

export = router;
