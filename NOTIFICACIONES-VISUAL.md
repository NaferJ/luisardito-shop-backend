# 📬 Sistema de Notificaciones - Resumen Visual

## 🎯 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React, Vue, etc)                │
│  - NotificationCenter                                             │
│  - Badge de No Leídas                                             │
│  - Toast Notifications (Opcional)                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP REST API
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    GET /notificaciones  PATCH /leído      DELETE /id
    GET /no-leidas       PATCH /leer-todas GET /:id
┌────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ RUTAS (src/routes/notificaciones.routes.js)             │  │
│  │ - Autenticación requerida en todas                       │  │
│  │ - Filtrado por usuario actual                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CONTROLADOR (src/controllers/notificaciones.controller.js)  │
│  │ - Listar, obtener, marcar leída, eliminar               │  │
│  │ - Validación y error handling                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SERVICIO (src/services/notificacion.service.js)         │  │
│  │ - Lógica de negocio                                      │  │
│  │ - Métodos específicos por tipo                           │  │
│  │ - Paginación, filtrado                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MODELO (src/models/notificacion.model.js)               │  │
│  │ - Estructura de datos                                    │  │
│  │ - Validaciones                                           │  │
│  │ - Asociaciones                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    SQL + Índices
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
    ┌────────────┐                    ┌──────────────┐
    │ Base Datos │                    │ Transacciones│
    │ MySQL/PG   │                    │ ACID         │
    └────────────┘                    └──────────────┘
```

## 📊 Flujo de Creación de Notificaciones

### Ejemplo: Usuario Canjea un Producto

```
Usuario hace POST /api/canjes
         │
         ▼
Controlador canjes.controller.js
         │
         ├─ Validar stock
         ├─ Validar puntos
         ├─ Aplicar promociones
         └─ Crear transacción
         │
         ▼
Dentro de la transacción:
         │
         ├─ 1. Crear Canje en BD
         ├─ 2. Descontar puntos
         ├─ 3. Restar stock
         ├─ 4. Registrar HistorialPunto
         │
         ├─ 5. 📬 CREAR NOTIFICACION ← ¡AQUÍ!
         │  NotificacionService.crearNotificacionCanjeCreado(
         │    usuarioId,
         │    { canje_id, nombre_producto, precio, ... },
         │    transaction  ← Misma transacción
         │  )
         │
         ├─ 6. Enviar mensaje a chat Kick
         └─ Commit transacción
         │
         ▼
Respuesta 201 al usuario
         │
         ▼
Usuario ve notificación en el frontend
```

## 🔄 Ciclo de Vida de una Notificación

```
┌─────────────────┐
│  CREADA (🆕)    │  fecha_creacion = NOW()
│  no_leida       │  estado = 'no_leida'
│  deleted_at NULL│  fecha_lectura = NULL
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ MOSTRADA EN LISTA        │  GET /api/notificaciones
│ (Usuario ve notificación)│  Aparece con badge "🔴"
└────────┬─────────────────┘
         │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─────────────┐ ┌──────────────────┐
│ MARCADA     │ │ IGNORADA         │
│ COMO LEÍDA  │ │ (Seguir no leída)│
│   (👁️)     │ │                  │
│ estado      │ │                  │
│ = 'leida'   │ │                  │
│ fecha_      │ │                  │
│ lectura=NOW │ │                  │
└─────┬───────┘ │                  │
      │         │                  │
      └─────┬───┘                  │
            │                      │
            ▼                      ▼
      ┌─────────────┐      ┌──────────────┐
      │ LEÍDA       │      │ NO LEÍDA     │
      │ (Usuario la │      │ (Aún visible)│
      │  vio)       │      └──────┬───────┘
      └─────┬───────┘             │
            │                 ┌────┴──────┐
            │                 │           │
            │                 ▼           ▼
            │            ┌──────────┐  ┌──────────┐
            │            │ ELIMINADA│  │ EXPIRADA │
            │            │ POR USER │  │ (90 días)│
            │            │deleted_  │  │          │
            │            │at=NOW()  │  │          │
            │            │(soft del)│  │          │
            │            └──────────┘  └──────────┘
            │                 │              │
            └────────────┬────┴──────────────┘
                         │
                         ▼
            ┌──────────────────────┐
            │ BORRADA (Soft Delete)│
            │ Aún existe en BD     │
            │ Invisible para usuario│
            │ Mantiene historial   │
            └──────────────────────┘
```

## 📈 Eventos que Generan Notificaciones

```
SISTEMA DE CANJES
├─ Crear canje
│  └─> Notificación: "canje_creado" 🛍️
├─ Marcar entregado
│  └─> Notificación: "canje_entregado" ✅
├─ Cancelar
│  └─> Notificación: "canje_cancelado" ❌
└─ Devolver
   └─> Notificación: "canje_devuelto" ↩️

WEBHOOK KICK
├─ Usuario sigue
│  └─> Notificación: "puntos_ganados" 💰
├─ Usuario se suscribe
│  └─> Notificación: "puntos_ganados" 💰
├─ Usuario canjea recompensa
│  └─> Notificación: "puntos_ganados" 💰
├─ Usuario regala suscripción (recibe)
│  └─> Notificación: "sub_regalada" 🎁
├─ Usuario regala suscripción (regala)
│  └─> Notificación: "puntos_ganados" 💰
└─ Usuario regala kicks
   └─> Notificación: "puntos_ganados" 💰
```

## 🔌 Integraciones Realizadas

```
┌─────────────────────────────────────────────────────────┐
│                    APP.JS (Main Entry)                   │
│  ✅ Importa: const notificacionesRoutes = require(...)  │
│  ✅ Registra: app.use("/api/notificaciones", ...)       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              MODELS/INDEX.JS (Model Registry)            │
│  ✅ Importa: const Notificacion = require(...)          │
│  ✅ Asocia: Usuario.hasMany(Notificacion)               │
│  ✅ Exporta: module.exports = { ..., Notificacion, ... }│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          CONTROLLERS/CANJES.CONTROLLER.JS                │
│  ✅ Importa: const NotificacionService = require(...)   │
│  ✅ En crear(): NotificacionService.crearNotificación...│
│  ✅ En actualizarEstado(): Crea notificación apropiada  │
│  ✅ En devolverCanje(): Crea notificación devolución    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│      CONTROLLERS/KICKWEBHOOK.CONTROLLER.JS               │
│  ✅ Importa: const NotificacionService = require(...)   │
│  ✅ En reward: crearNotificacionPuntosGanados()         │
│  ✅ En follow: crearNotificacionPuntosGanados()         │
│  ✅ En subscribe: crearNotificacionPuntosGanados()      │
│  ✅ En kicks gifted: crearNotificacionPuntosGanados()   │
│  ✅ En sub gifts: crearNotificacionSubRegalada()        │
└─────────────────────────────────────────────────────────┘
```

## 📦 Archivos Creados - Vista Rápida

```
luisardito-shop-backend/
├── src/
│   ├── models/
│   │   ├── notificacion.model.js ✨ (NUEVO)
│   │   └── index.js (MODIFICADO)
│   ├── services/
│   │   └── notificacion.service.js ✨ (NUEVO)
│   ├── controllers/
│   │   ├── notificaciones.controller.js ✨ (NUEVO)
│   │   ├── canjes.controller.js (MODIFICADO)
│   │   └── kickWebhook.controller.js (MODIFICADO)
│   └── routes/
│       └── notificaciones.routes.js ✨ (NUEVO)
├── migrations/
│   └── 20260103000001-create-notificaciones.js ✨ (NUEVO)
├── app.js (MODIFICADO)
├── SISTEMA-NOTIFICACIONES-IMPLEMENTACION.md ✨ (NUEVO)
├── SISTEMA-NOTIFICACIONES-EJEMPLOS.md ✨ (NUEVO)
├── NOTIFICACIONES-QUICKSTART.md ✨ (NUEVO)
├── NOTIFICACIONES-DEPLOYMENT.md ✨ (NUEVO)
└── run-notifications-setup.sh ✨ (NUEVO)
```

## 🧠 Lógica de Transacciones

```
Para operaciones que crean notificaciones:

┌─────────────────────────────────────────────┐
│ BEGIN TRANSACTION                            │
├─────────────────────────────────────────────┤
│ 1. Cambio en tabla principal (Canje)        │
│    UPDATE canjes SET estado='entregado'     │
│                                             │
│ 2. Cambio en tabla relacionada              │
│    UPDATE usuarios SET puntos=... (Si aplica)
│                                             │
│ 3. Registro en historial                    │
│    INSERT INTO historial_puntos             │
│                                             │
│ 4. 📬 CREAR NOTIFICACIÓN                   │
│    INSERT INTO notificaciones (Misma transacción)
│                                             │
│ ✅ COMMIT (Todo se guarda juntos)           │
└─────────────────────────────────────────────┘

Ventajas:
- Atomicidad: Todo o nada
- Si algo falla, ROLLBACK recupera todo
- Notificación nunca queda "huérfana"
```

## 🎯 Tipos de Notificaciones y Sus Datos

```
┌──────────────────┬──────────────────────┬──────────────┐
│ Tipo             │ Datos Principales    │ Enlace       │
├──────────────────┼──────────────────────┼──────────────┤
│ canje_creado 🛍️  │ canje_id             │ /canjes/{id} │
│                  │ nombre_producto      │              │
│                  │ precio               │              │
│                  │ promocion_aplicada   │              │
├──────────────────┼──────────────────────┼──────────────┤
│ canje_entregado ✅ │ canje_id           │ /canjes/{id} │
│                  │ nombre_producto      │              │
├──────────────────┼──────────────────────┼──────────────┤
│ canje_cancelado ❌ │ canje_id           │ /canjes/{id} │
│                  │ nombre_producto      │              │
│                  │ motivo               │              │
├──────────────────┼──────────────────────┼──────────────┤
│ canje_devuelto ↩️  │ canje_id           │ /canjes/{id} │
│                  │ nombre_producto      │              │
│                  │ puntos_devueltos     │              │
├──────────────────┼──────────────────────┼──────────────┤
│ puntos_ganados 💰 │ cantidad             │ /historial   │
│                  │ concepto             │              │
│                  │ tipo_evento          │              │
├──────────────────┼──────────────────────┼──────────────┤
│ sub_regalada 🎁  │ regalador_username   │ /suscriptos  │
│                  │ monto_subscription   │              │
│                  │ puntos_otorgados     │              │
└──────────────────┴──────────────────────┴──────────────┘
```

## 🚀 Endpoints Disponibles

```
GET /api/notificaciones
├─ page: 1 (default)
├─ limit: 20 (default, max 100)
├─ tipo: 'puntos_ganados' (optional)
├─ estado: 'no_leida' (optional)
└─ Response: { total, page, limit, pages, notificaciones[] }

GET /api/notificaciones/no-leidas/contar
└─ Response: { cantidad: 3 }

GET /api/notificaciones/:id
└─ (Auto marca como leída)
└─ Response: notificacion { ... }

PATCH /api/notificaciones/:id/leido
└─ Response: { mensaje: "...", notificacion: { ... } }

PATCH /api/notificaciones/leer-todas
└─ Response: { mensaje: "...", cantidad_actualizadas: 12 }

DELETE /api/notificaciones/:id
└─ Response: { id: 1, mensaje: "Notificación eliminada" }
```

## ⚡ Performance

```
Índices Creados:
├─ usuario_id (Búsquedas por usuario)
├─ estado (Búsquedas por estado leído/no leído)
├─ tipo (Búsquedas por tipo de evento)
├─ (usuario_id, estado) (Combo para queries frecuentes)
└─ fecha_creacion DESC (Orden de lista)

Queries Optimizadas:
├─ Listar por usuario: O(log n) con índice
├─ Contar no leídas: O(1) con índice
├─ Filtrar por tipo: O(log n) con índice
└─ Paginación: LIMIT 20 + OFFSET

Límites de Seguridad:
├─ Máximo 100 registros por página
├─ Validación de permisos por usuario
└─ Soft deletes (no pierden datos)
```

## 🎓 Ejemplo de Uso Básico (Frontend)

```javascript
// 1. Contar no leídas (para badge)
const { cantidad } = await fetch(
  '/api/notificaciones/no-leidas/contar'
).then(r => r.json());

// Mostrar badge con cantidad

// 2. Listar notificaciones
const { notificaciones } = await fetch(
  '/api/notificaciones?page=1&limit=20'
).then(r => r.json());

// 3. Al hacer click en una notificación
const notif = await fetch(
  `/api/notificaciones/${id}`
).then(r => r.json());

// Se marca como leída automáticamente

// 4. Navegar al detalle
window.location.href = notif.enlace_detalle;
```

## 📊 Estadísticas Posibles

```
Con queries SQL:
┌─────────────────────────────────────────────┐
│ SELECT COUNT(*) FROM notificaciones         │ → Total
│ WHERE estado = 'no_leida'                   │ → No leídas
│                                             │
│ SELECT tipo, COUNT(*) FROM notificaciones   │ → Por tipo
│ GROUP BY tipo                               │
│                                             │
│ SELECT usuario_id, COUNT(*) FROM notificaciones
│ GROUP BY usuario_id ORDER BY COUNT DESC     │ → Top usuarios
└─────────────────────────────────────────────┘
```

## ✨ Conclusión

Sistema **profesional, escalable y transaccional** de notificaciones completamente integrado con todos los eventos importantes del sistema.

✅ Listo para producción  
✅ Bien documentado  
✅ Con ejemplos completos  
✅ Seguro y auditado  
✅ Optimizado para performance  

