import { Router } from "express";
import usuariosCtrl from "../controllers/usuarios.controller";
import canjesCtrl from "../controllers/canjes.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = Router();

// Protected routes - Require strict authentication

// Get profile of the logged-in user
router.get("/me", authRequired, usuariosCtrl.me);

// Update profile of the logged-in user
router.put("/me", authRequired, usuariosCtrl.updateMe);

// Sync Kick info (avatar, username, etc.)
router.post("/sync-kick-info", authRequired, usuariosCtrl.syncKickInfo);

// Protected routes with specific permissions

// List all users (admin)
router.get(
  "/",
  authRequired,
  permiso("ver_usuarios"),
  usuariosCtrl.listarUsuarios
);

// Canjes for a specific user (admin/management)
router.get(
  "/:usuarioId/canjes",
  authRequired,
  permiso("gestionar_canjes"),
  canjesCtrl.listarPorUsuario
);

// Update points for a specific user (admin)
router.put(
  "/:id/puntos",
  authRequired,
  permiso("editar_puntos"),
  usuariosCtrl.actualizarPuntos
);

// Public routes (debug/testing - consider protecting in production)

// Debug: Check roles and permissions structure
router.get("/debug/roles-permisos", usuariosCtrl.debugRolesPermisos);

// Debug: Check specific user by ID
router.get("/debug/:usuarioId", usuariosCtrl.debugUsuario);

// Hotfix: Update role for a specific user (temporary - consider protecting)
router.put(
  "/hotfix/:usuarioId/rol/:nuevoRolId",
  usuariosCtrl.hotfixActualizarRol
);

export = router;
