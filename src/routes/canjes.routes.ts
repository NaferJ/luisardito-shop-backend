import { Router } from "express";
import canjesCtrl from "../controllers/canjes.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = Router();

// Rutas protegidas - Todas requieren autenticación estricta + permisos

// Crear un nuevo canje
router.post("/", authRequired, permiso("canjear_productos"), canjesCtrl.crear);

// Ruta para Mis Canjes: siempre retorna solo los del usuario autenticado
router.get("/mios", authRequired, permiso("ver_canjes"), canjesCtrl.listarMios);

// Ruta para listar canjes de un usuario específico (admin/gestión)
router.get(
  "/usuario/:usuarioId",
  authRequired,
  permiso("gestionar_canjes"),
  canjesCtrl.listarPorUsuario
);

// Ruta global (admin/gestión): retorna todos los canjes
router.get("/", authRequired, permiso("gestionar_canjes"), canjesCtrl.listar);

// Actualizar estado de un canje
router.put(
  "/:id",
  authRequired,
  permiso("gestionar_canjes"),
  canjesCtrl.actualizarEstado
);

// Devolver canje (refunda puntos y marca como devuelto)
router.put(
  "/:id/devolver",
  authRequired,
  permiso("gestionar_canjes"),
  canjesCtrl.devolverCanje
);

export = router;
