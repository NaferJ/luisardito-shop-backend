# 📬 Sistema de Notificaciones - Resumen Rápido

## ⚡ Lo Más Importante

### Migración
```bash
npm run migrate
# O: npx sequelize-cli db:migrate
```

### Tabla Creada
- **Nombre**: `notificaciones`
- **Campos clave**: usuario_id, titulo, descripcion, tipo, estado, datos_relacionados, enlace_detalle

### Rutas Disponibles
```
GET    /api/notificaciones                    - Listar (page, limit, tipo, estado)
GET    /api/notificaciones/no-leidas/contar   - Contar no leídas
GET    /api/notificaciones/:id                - Detalle (marca leída automáticamente)
PATCH  /api/notificaciones/:id/leido          - Marcar como leída
PATCH  /api/notificaciones/leer-todas         - Marcar todas como leídas
DELETE /api/notificaciones/:id                - Eliminar (soft delete)
```

## 📦 Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `src/models/notificacion.model.js` | Modelo Sequelize |
| `src/services/notificacion.service.js` | Lógica de negocio |
| `src/controllers/notificaciones.controller.js` | Endpoints HTTP |
| `src/routes/notificaciones.routes.js` | Definición de rutas |
| `migrations/20260103000001-create-notificaciones.js` | Migración BD |

## 🔄 Integración Automática

### En Canjes (`src/controllers/canjes.controller.js`)
- ✅ Crear canje → notificación `canje_creado`
- ✅ Marcar entregado → notificación `canje_entregado`
- ✅ Cancelar → notificación `canje_cancelado`
- ✅ Devolver → notificación `canje_devuelto`

### En Webhook Kick (`src/controllers/kickWebhook.controller.js`)
- ✅ Reward redemption → `puntos_ganados`
- ✅ Channel follow → `puntos_ganados`
- ✅ New subscription → `puntos_ganados`
- ✅ Kicks gifted → `puntos_ganados`
- ✅ Sub gift (regalador) → `puntos_ganados`
- ✅ Sub gift (receptor) → `sub_regalada`

## 🎯 Tipos de Notificaciones

```javascript
const tipos = [
  'sub_regalada',         // 🎁 Suscripción regalada
  'puntos_ganados',       // 💰 Puntos ganados
  'canje_creado',         // 🛍️ Canje creado
  'canje_entregado',      // ✅ Entregado
  'canje_cancelado',      // ❌ Cancelado
  'canje_devuelto',       // ↩️ Devuelto
  'historial_evento',     // 📝 Evento historial
  'sistema'               // ⚡ Sistema general
];
```

## 💡 Ejemplos de Uso

### Listar Notificaciones
```javascript
const response = await fetch('/api/notificaciones?page=1&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { notificaciones, total, pages } = await response.json();
```

### Filtrar por Tipo
```javascript
await fetch('/api/notificaciones?tipo=puntos_ganados', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Obtener Detalle
```javascript
const notificacion = await fetch('/api/notificaciones/1', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
// Automáticamente marca como leída
```

### Contar No Leídas
```javascript
const { cantidad } = await fetch('/api/notificaciones/no-leidas/contar', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

### Marcar Todas Como Leídas
```javascript
await fetch('/api/notificaciones/leer-todas', {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 📝 Estructura de Notificación

```json
{
  "id": 1,
  "usuario_id": 5,
  "titulo": "¡Ganaste 100 puntos!",
  "descripcion": "Has ganado 100 puntos por: Canje de recompensa: Extra Kick",
  "tipo": "puntos_ganados",
  "estado": "no_leida",
  "datos_relacionados": {
    "cantidad": 100,
    "concepto": "Canje de recompensa: Extra Kick",
    "tipo_evento": "channel.reward.redemption.updated"
  },
  "enlace_detalle": "/historial-puntos",
  "fecha_lectura": null,
  "deleted_at": null,
  "fecha_creacion": "2026-01-03T10:30:45.000Z",
  "fecha_actualizacion": "2026-01-03T10:30:45.000Z"
}
```

## 🛠️ Personalización

### Agregar Nuevo Tipo de Notificación

1. **Actualizar modelo** (`src/models/notificacion.model.js`):
```javascript
tipo: {
  type: DataTypes.ENUM(
    'sub_regalada',
    'puntos_ganados',
    'canje_creado',
    // ... nuevos tipos aquí
    'mi_nuevo_tipo'
  ),
  // ...
}
```

2. **Actualizar migración** (crear nueva):
```javascript
// En la migración, cambiar el ENUM
ALTER TABLE notificaciones MODIFY tipo ENUM(...);
```

3. **Agregar método en servicio** (`src/services/notificacion.service.js`):
```javascript
static async crearNotificacionMiNuevoTipo(usuarioId, datos, transaction = null) {
  return this.crear(
    usuarioId,
    'Título',
    'Descripción',
    'mi_nuevo_tipo',
    datos,
    '/enlace',
    transaction
  );
}
```

4. **Usar en controlador correspondiente**:
```javascript
await NotificacionService.crearNotificacionMiNuevoTipo(
  usuarioId,
  { datos: 'contexto' },
  transaction
);
```

## 🔒 Seguridad

- ✅ Autenticación requerida en todas las rutas
- ✅ Usuarios solo ven sus propias notificaciones
- ✅ Soft deletes (no se pierden datos)
- ✅ Transacciones ACID

## 📊 Performance

- ✅ Índices en: usuario_id, estado, tipo, fecha_creacion
- ✅ Índice compuesto: (usuario_id, estado)
- ✅ Paginación soportada

## 🔧 Troubleshooting

### Notificaciones no aparecen
1. Verificar que la migración se ejecutó: `SELECT COUNT(*) FROM notificaciones;`
2. Verificar que el usuario está autenticado
3. Verificar que la transacción se commitió correctamente

### Errores de ENUM
- Asegurar que el valor de `tipo` está en el ENUM del modelo
- Verificar que la migración es compatible con la BD

## 📚 Documentación Completa

Ver:
- `SISTEMA-NOTIFICACIONES-IMPLEMENTACION.md` - Documentación completa
- `SISTEMA-NOTIFICACIONES-EJEMPLOS.md` - Ejemplos y casos de uso

## ✨ Lo Siguiente

1. Ejecutar migración: `npm run migrate`
2. Testear endpoints con Postman/Insomnia
3. Integrar en frontend (ver ejemplos React)
4. (Opcional) Agregar WebSockets para tiempo real
5. (Opcional) Agregar preferencias de usuario

