import { Router } from "express";
import productosCtrl from "../controllers/productos.controller";
import auth from "../middleware/auth.middleware";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = Router();

// Rutas públicas - Sin autenticación requerida
router.get("/", productosCtrl.listar);

// IMPORTANTE: Rutas específicas DEBEN ir ANTES de rutas con parámetros (/:id)
// Si no, Express confunde "admin" o "debug" como un ID

// Rutas específicas primero
router.get("/debug/all", productosCtrl.debugListar); // Debug endpoint
router.get(
  "/admin",
  authRequired,
  permiso("gestionar_canjes"),
  productosCtrl.listarAdmin
); // Admin

// Rutas con autenticación opcional (rutas específicas)
router.get("/slug/:slug", auth, productosCtrl.obtenerPorSlug);

// Rutas con parámetros dinámicos (DEBEN IR AL FINAL)
router.get("/:id", productosCtrl.obtener); // ← Esta debe ir al final

// Rutas protegidas con modificación
router.post("/", authRequired, permiso("crear_producto"), productosCtrl.crear);
router.put(
  "/:id",
  authRequired,
  permiso("editar_producto"),
  productosCtrl.editar
);
router.put(
  "/:id/promociones",
  authRequired,
  permiso("editar_producto"),
  productosCtrl.actualizarPromociones
);
router.delete(
  "/:id",
  authRequired,
  permiso("eliminar_producto"),
  productosCtrl.eliminar
);

export = router;
