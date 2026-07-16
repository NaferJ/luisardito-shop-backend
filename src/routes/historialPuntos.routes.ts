import { Router } from "express";
import historialCtrl from "../controllers/historialPuntos.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = Router();

// Rutas protegidas - Todas requieren autenticación estricta + permisos

// Listar historial de puntos de un usuario (filtrado, sin eventos de chat)
router.get(
  "/:usuarioId",
  authRequired,
  permiso("ver_historial_puntos"),
  historialCtrl.listar
);

// Listar historial completo (incluyendo eventos de chat) - Solo administradores
router.get(
  "/:usuarioId/completo",
  authRequired,
  permiso("editar_puntos"),
  historialCtrl.listarCompleto
);

export = router;
