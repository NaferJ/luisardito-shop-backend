# 📊 Resumen de Implementación: Max Points y Watchtime

## ✅ Implementación Completada

Se han agregado exitosamente dos nuevas funcionalidades al sistema de leaderboard:

### 1️⃣ Sistema de Puntos Máximos (Max Points)
- **Qué hace:** Rastrea el máximo de puntos que ha alcanzado cada usuario en su historial
- **Cuándo se actualiza:** Automáticamente cada vez que el usuario supera su máximo anterior
- **Dónde se usa:** En el endpoint del leaderboard para filtrado/ordenamiento en frontend

### 2️⃣ Sistema de Watchtime Híbrido
- **Qué hace:** Acumula tiempo de visualización basado en actividad en el chat
- **Cómo funciona:** +5 minutos por mensaje (máximo 1 mensaje cada 5 minutos con cooldown de Redis)
- **Qué registra:**
  - Total de minutos de watchtime
  - Cantidad de mensajes
  - Fecha del primer mensaje
  - Fecha del último mensaje

---

## 📁 Archivos Creados

### Migraciones
```
✅ migrations/20260103000002-add-max-puntos-to-usuarios.js
   └─ Agrega columna max_puntos a tabla usuarios
   
✅ migrations/20260103000003-create-user-watchtime.js
   └─ Crea tabla user_watchtime con estructura completa
   
✅ migrations/manual-apply-max-puntos-watchtime.sql
   └─ Script SQL manual para aplicar cambios directamente
```

### Modelos
```
✅ src/models/userWatchtime.model.js
   └─ Nuevo modelo Sequelize para tabla user_watchtime
   └─ Incluye asociaciones con Usuario
```

### Scripts Auxiliares
```
✅ initialize-watchtime.js
   └─ Inicializa datos para usuarios existentes post-migración
   
✅ verify-implementation.js
   └─ Verifica que todos los cambios estén correctamente implementados
```

### Documentación
```
✅ LEADERBOARD-MAX-PUNTOS-WATCHTIME.md
   └─ Guía completa de implementación y uso
```

---

## 📝 Archivos Modificados

### Modelos
**src/models/usuario.model.js**
```diff
+ max_puntos: {
+   type: DataTypes.INTEGER,
+   defaultValue: 0,
+   comment: 'Máximo de puntos que ha alcanzado el usuario en su historial'
+ }
```

**src/models/index.js**
```diff
+ const UserWatchtime = require("./userWatchtime.model");
+ 
+ // Asociaciones de UserWatchtime
+ Usuario.hasOne(UserWatchtime, { foreignKey: "usuario_id", as: "watchtime" });
+ UserWatchtime.belongsTo(Usuario, { foreignKey: "usuario_id" });
+
  module.exports = {
    ...
+   UserWatchtime,
  };
```

### Controladores
**src/controllers/kickWebhook.controller.js** - `handleChatMessage()`
```diff
  // Otorgar puntos
  await usuario.increment("puntos", { by: pointsToAward }, { transaction });

+ // Actualizar max_puntos si es necesario
+ const usuarioActualizado = await usuario.reload({ transaction });
+ if (usuarioActualizado.puntos > usuarioActualizado.max_puntos) {
+   await usuarioActualizado.update(
+     { max_puntos: usuarioActualizado.puntos },
+     { transaction }
+   );
+   logger.info(`🏆 [MAX POINTS] Nuevo máximo: ${usuarioActualizado.puntos}`);
+ }

  // Registrar en historial
  await HistorialPunto.create({...});

+ // 🕐 AGREGAR WATCHTIME
+ let watchtime = await UserWatchtime.findOne({ where: { usuario_id: usuario.id } });
+ if (!watchtime) {
+   watchtime = await UserWatchtime.create({
+     usuario_id: usuario.id,
+     kick_user_id: kickUserId,
+     total_watchtime_minutes: 5,
+     message_count: 1,
+     first_message_date: now,
+     last_message_at: now,
+   }, { transaction });
+ } else {
+   await watchtime.increment(
+     { total_watchtime_minutes: 5, message_count: 1 },
+     { transaction }
+   );
+   await watchtime.update({ last_message_at: now }, { transaction });
+ }
```

### Servicios
**src/services/leaderboard.service.js** - `_getCurrentRanking()`
```diff
  async _getCurrentRanking() {
+   const { UserWatchtime } = require("../models");
    
    const usuarios = await Usuario.findAll({
      attributes: [
        "id", "nickname", "puntos",
+       "max_puntos",
        ...
      ],
+     include: [
+       {
+         model: UserWatchtime,
+         as: "watchtime",
+         attributes: ["total_watchtime_minutes", "message_count"],
+         required: false,
+       }
+     ],
      ...
    });
    
    return usuariosConPosicion.map(usuario => ({
      ...
+     max_puntos: usuario.max_puntos || 0,
+     watchtime_minutes: usuario["watchtime.total_watchtime_minutes"] || 0,
+     message_count: usuario["watchtime.message_count"] || 0,
    }));
  }
```

---

## 🔄 Flujo de Datos

### Cuando un usuario envía un mensaje en Kick:

```
[Webhook chat.message.sent]
    ↓
[Verificar stream está en vivo]
    ↓
[Verificar cooldown Redis (5 min)]
    ↓ Pasa cooldown
[Incrementar puntos]
    ↓
[Actualizar max_puntos si necesario] ← NUEVO
    ↓
[Registrar en HistorialPunto]
    ↓
[Crear/Actualizar registro de watchtime] ← NUEVO
    ↓ Incrementar +5 minutos
[Commit transacción]
```

---

## 📊 Estructura de Base de Datos

### Tabla: `usuarios`
```sql
ALTER TABLE usuarios ADD COLUMN max_puntos INT NOT NULL DEFAULT 0;

-- Los valores iniciales se establecen en 0
-- Se actualizan a través de updateUsuario o directamente en el webhook
```

### Tabla: `user_watchtime` (NUEVA)
```sql
CREATE TABLE user_watchtime (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL UNIQUE,
  kick_user_id VARCHAR(255),
  total_watchtime_minutes INT DEFAULT 0,
  message_count INT DEFAULT 0,
  first_message_date DATETIME,
  last_message_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX (kick_user_id),
  INDEX (total_watchtime_minutes)
);
```

---

## 🚀 Próximos Pasos en Producción

### 1. Aplicar Migraciones
```bash
# Opción A: Usar Sequelize CLI
npm run migrate

# Opción B: Ejecutar SQL directamente
docker-compose exec db mysql -u app -papp luisardito_shop < migrations/manual-apply-max-puntos-watchtime.sql
```

### 2. Inicializar Datos
```bash
# Crea registros de watchtime para usuarios existentes
node initialize-watchtime.js
```

### 3. Verificar Implementación
```bash
# Verificar que todo está correcto
node verify-implementation.js
```

### 4. Reiniciar Servidor
```bash
# Detener y reiniciar
docker-compose restart luisardito-backend
```

### 5. Probar Funcionalidad
```bash
# Enviar mensaje en Kick
# Verificar que se actualiza max_puntos y watchtime

# Consultar leaderboard
curl http://localhost:3000/api/leaderboard?limit=5
```

---

## ✨ Ejemplo de Respuesta del Leaderboard

### Antes:
```json
{
  "usuario_id": 3,
  "nickname": "NaferJ",
  "display_name": "naferj",
  "puntos": 1018437,
  "position": 1,
  "is_vip": true
}
```

### Después:
```json
{
  "usuario_id": 3,
  "nickname": "NaferJ",
  "display_name": "naferj",
  "puntos": 1018437,
  "max_puntos": 1018437,
  "watchtime_minutes": 245,
  "message_count": 49,
  "position": 1,
  "is_vip": true
}
```

---

## 🧪 Verificación Post-Implementación

```sql
-- Verificar estructura
DESC usuarios;
DESC user_watchtime;

-- Verificar datos
SELECT usuario_id, puntos, max_puntos FROM usuarios WHERE puntos > 0 LIMIT 5;
SELECT * FROM user_watchtime WHERE usuario_id = 3;

-- Verificar actualizaciones en tiempo real
-- Después de enviar un mensaje en Kick:
SELECT usuario_id, puntos, max_puntos FROM usuarios WHERE id = 3;
SELECT * FROM user_watchtime WHERE usuario_id = 3;
```

---

## 📋 Checklist de Implementación

- [x] Crear migraciones para max_puntos
- [x] Crear migraciones para user_watchtime
- [x] Crear modelo UserWatchtime
- [x] Actualizar modelo Usuario con max_puntos
- [x] Actualizar models/index.js con asociaciones
- [x] Implementar lógica de max_puntos en webhook
- [x] Implementar lógica de watchtime en webhook
- [x] Actualizar leaderboard service para incluir nuevos campos
- [x] Crear script de inicialización
- [x] Crear script de verificación
- [x] Documentar cambios
- [x] Validar sintaxis de todos los archivos
- [ ] Aplicar migraciones en BD
- [ ] Ejecutar script de inicialización
- [ ] Reiniciar servidor
- [ ] Probar webhook con mensaje en Kick
- [ ] Probar endpoint /api/leaderboard
- [ ] Verificar logs con [MAX POINTS] y [WATCHTIME]

---

## 📞 Soporte

Si encuentras algún problema:

1. **Verificar sintaxis:** `node verify-implementation.js`
2. **Revisar logs:** Buscar `[MAX POINTS]` y `[WATCHTIME]`
3. **Consultar guía:** `LEADERBOARD-MAX-PUNTOS-WATCHTIME.md`
4. **Verificar BD:** Ejecutar queries de verificación arriba

---

**Fecha:** 2026-01-04
**Versión:** 1.0
**Estado:** ✅ Listo para producción

