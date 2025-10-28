# 🚀 NUEVAS FUNCIONALIDADES IMPLEMENTADAS

## Funcionalidades Agregadas

### 1. 🔄 Migración Automática de Puntos desde Botrix

**Descripción:** Sistema automático que detecta cuando el bot BotRix responde con puntos de un usuario y los migra automáticamente a la tienda.

**Funcionamiento:**
- Detecta mensajes de chat que contengan el patrón: `@usuario tiene X puntos.`
- Solo funciona si el mensaje viene del usuario `BotRix`
- Migra los puntos una sola vez por usuario
- Crea registro en historial de puntos

**Configuración:**
- Se puede activar/desactivar desde `/api/kick-admin/migration`
- Estado en `/api/kick-admin/config`

**Base de Datos:**
- Tabla: `botrix_migration_config`
- Campos agregados a `usuarios`: `botrix_migrated`, `botrix_migrated_at`, `botrix_points_migrated`

---

### 2. 🌟 Sistema VIP

**Descripción:** Soporte completo para usuarios VIP con puntos especiales y gestión automática.

**Características:**
- **Puntos especiales:** VIPs pueden ganar diferentes cantidades de puntos por chat, follows y suscripciones
- **Duración configurable:** VIP puede ser permanente o temporal (días específicos)
- **Otorgamiento automático:** Al marcar un canje como "entregado" de un producto que contenga "VIP" en el nombre
- **Limpieza automática:** Task que limpia VIPs expirados todos los días a las 3:00 AM

**Gestión VIP:**
- Otorgar VIP: `POST /api/kick-admin/canje/:canjeId/grant-vip`
- Remover VIP: `DELETE /api/kick-admin/usuario/:usuarioId/vip`
- Limpiar expirados: `POST /api/kick-admin/cleanup-expired-vips`

**Configuración de puntos VIP:**
- Activar/desactivar: `PUT /api/kick-admin/vip-config`
- Ver configuración: `GET /api/kick-admin/config`

**Base de Datos:**
- Campos agregados a `usuarios`: `is_vip`, `vip_granted_at`, `vip_expires_at`, `vip_granted_by_canje_id`
- Configuración en: `botrix_migration_config`

---

### 3. 📱 Campo Discord

**Descripción:** Soporte para guardar el nombre de usuario de Discord.

**Uso:**
- Actualizar Discord: `PUT /api/usuarios/me` con `{ "discord_username": "usuario#1234" }`
- Se muestra en respuestas de usuarios y listados de admin

**Base de Datos:**
- Campo agregado a `usuarios`: `discord_username`

---

## Endpoints de Administración

### Configuración
- `GET /api/kick-admin/config` - Ver configuración actual
- `PUT /api/kick-admin/migration` - Activar/desactivar migración Botrix
- `PUT /api/kick-admin/vip-config` - Configurar puntos VIP

### Gestión VIP
- `POST /api/kick-admin/canje/:canjeId/grant-vip` - Otorgar VIP desde canje
- `DELETE /api/kick-admin/usuario/:usuarioId/vip` - Remover VIP
- `POST /api/kick-admin/cleanup-expired-vips` - Limpiar VIPs expirados

### Consultas
- `GET /api/kick-admin/users` - Lista usuarios con info VIP/migración
- `POST /api/kick-admin/manual-migration` - Migración manual (testing)

---

## Endpoints de Debug

### Webhooks
- `POST /api/kick-webhook/debug-botrix-migration` - Simular migración Botrix
- `GET /api/kick-webhook/debug-system-info` - Info del sistema VIP/migración

### Usuarios
- `GET /api/usuarios/debug/roles-permisos` - Debug completo de roles y permisos
- `GET /api/usuarios/debug/:usuarioId` - Debug específico de usuario
- `PUT /api/usuarios/hotfix/:usuarioId/rol/:nuevoRolId` - Cambio rápido de rol

---

## Integraciones con Sistema Existente

### Webhooks Mejorados
- **Chat:** Ahora detecta migración Botrix y calcula puntos VIP
- **Follows:** Soporte para puntos VIP
- **Suscripciones:** Soporte para puntos VIP

### Canjes Mejorados
- **Auto-VIP:** Al marcar canje como "entregado" de producto VIP, otorga VIP automáticamente
- **Detección inteligente:** Detecta duración desde nombre del producto ("30 días", "1 mes", etc.)

### Historial de Puntos Filtrado
- **Usuarios normales:** Solo ven eventos importantes (migración, VIP, follows, subs)
- **Admins:** Ven todo el historial completo
- **Eventos ocultos:** Chat automático se oculta por defecto

---

## Configuraciones por Defecto

### Migración Botrix
- **Habilitada:** `true`
- **Una vez por usuario:** Solo migra la primera vez

### Puntos VIP
- **Habilitados:** `false` (desactivado por defecto)
- **Chat VIP:** 5 puntos
- **Follow VIP:** 100 puntos  
- **Sub VIP:** 300 puntos

---

## Migraciones de Base de Datos

Nuevos archivos de migración creados:
- `20251028000001-add-usuario-features.js` - Campos VIP, Botrix y Discord
- `20251028000002-create-botrix-migration-config.js` - Tabla de configuración

Para aplicar:
```bash
npm run migrate
```

---

## Tareas Automáticas

### Limpieza VIP
- **Frecuencia:** Diario a las 3:00 AM
- **Función:** Limpia VIPs expirados automáticamente
- **Manual:** Endpoint disponible para ejecutar manualmente

### Refresh Tokens
- **Existente:** Ya configurado para mantener webhooks activos
- **Mejorado:** Ahora soporta App Tokens permanentes

---

## Consideraciones de Seguridad

- **Migración Botrix:** Solo acepta mensajes del usuario exacto "BotRix"
- **VIP Automático:** Solo se otorga al marcar canjes como "entregado"
- **Permisos:** Todos los endpoints admin requieren permisos específicos
- **Validaciones:** Múltiples validaciones para evitar duplicados y errores

---

## Testing

### Simulaciones Disponibles
- **Migración Botrix:** `POST /api/kick-webhook/debug-botrix-migration`
- **Sistema VIP:** Endpoints de debug para verificar funcionamiento

### Verificaciones
- **Estado general:** `GET /api/kick-admin/config`
- **Usuarios específicos:** `GET /api/usuarios/debug/:usuarioId`
- **Roles y permisos:** `GET /api/usuarios/debug/roles-permisos`
