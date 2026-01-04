# 🏆 Sistema de Max Points y Watchtime - Guía de Implementación

## 📋 Resumen de Cambios

Se han implementado dos nuevas funcionalidades en el leaderboard:

### 1. **Sistema de Puntos Máximos (Max Points)**
- Nuevo campo `max_puntos` en tabla `usuarios`
- Rastrea el máximo de puntos que ha alcanzado cada usuario
- Se actualiza automáticamente cuando el usuario supera su máximo anterior
- Se devuelve en el endpoint del leaderboard para filtrado/ordenamiento en frontend

### 2. **Sistema de Watchtime Híbrido**
- Nueva tabla `user_watchtime` para rastrear tiempo de visualización
- Se acumula con cooldown: +5 minutos por mensaje (máximo 1 mensaje cada 5 minutos)
- Registra:
  - `total_watchtime_minutes`: minutos totales acumulados
  - `message_count`: cantidad de mensajes registrados
  - `first_message_date`: fecha del primer mensaje
  - `last_message_at`: fecha del último mensaje

## 🔧 Pasos de Implementación

### Opción 1: Usando Migrations de Sequelize (Recomendado)

```bash
# Ejecutar migraciones en el contenedor
npm run migrate

# O manualmente en docker
docker-compose exec db mysql -u app -papp luisardito_shop < migrations/manual-apply-max-puntos-watchtime.sql
```

### Opción 2: Aplicar SQL Manualmente

1. Conectar a la base de datos MySQL
2. Ejecutar el contenido de `migrations/manual-apply-max-puntos-watchtime.sql`

```sql
-- Script disponible en: migrations/manual-apply-max-puntos-watchtime.sql
ALTER TABLE usuarios ADD COLUMN max_puntos INT NOT NULL DEFAULT 0;
UPDATE usuarios SET max_puntos = puntos WHERE puntos > 0;
CREATE TABLE user_watchtime (...);
```

## 🚀 Inicialización de Datos

Después de aplicar las migraciones, ejecutar:

```bash
# Crear registros iniciales de watchtime para usuarios existentes
node initialize-watchtime.js
```

Este script:
- ✅ Actualiza `max_puntos` para usuarios existentes
- ✅ Crea registros de `user_watchtime` para usuarios con puntos

## 📡 Cambios en API

### Endpoint: GET /api/leaderboard

**Respuesta anterior:**
```json
{
  "success": true,
  "data": [
    {
      "usuario_id": 3,
      "nickname": "NaferJ",
      "puntos": 1018437,
      "position": 1,
      "is_vip": true,
      ...
    }
  ]
}
```

**Respuesta actualizada:**
```json
{
  "success": true,
  "data": [
    {
      "usuario_id": 3,
      "nickname": "NaferJ",
      "puntos": 1018437,
      "max_puntos": 1018437,
      "watchtime_minutes": 245,
      "message_count": 49,
      "position": 1,
      "is_vip": true,
      ...
    }
  ]
}
```

### Nuevos campos en respuesta:
- **`max_puntos`**: Máximo de puntos alcanzado históricamente
- **`watchtime_minutes`**: Total de minutos de watchtime acumulados
- **`message_count`**: Total de mensajes registrados

## 💾 Cambios en Base de Datos

### Tabla: `usuarios`
```sql
ALTER TABLE usuarios ADD COLUMN max_puntos INT NOT NULL DEFAULT 0;
```

### Tabla: `user_watchtime` (Nueva)
```sql
CREATE TABLE user_watchtime (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL UNIQUE,
  kick_user_id VARCHAR(255) NULL,
  total_watchtime_minutes INT NOT NULL DEFAULT 0,
  message_count INT NOT NULL DEFAULT 0,
  first_message_date DATETIME NULL,
  last_message_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user_watchtime_usuario_id 
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) 
    ON UPDATE CASCADE ON DELETE CASCADE,
  
  INDEX idx_user_watchtime_usuario_id (usuario_id),
  INDEX idx_user_watchtime_kick_user_id (kick_user_id),
  INDEX idx_user_watchtime_total_minutes (total_watchtime_minutes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 🔄 Lógica de Webhook (chat.message.sent)

En `src/controllers/kickWebhook.controller.js`, función `handleChatMessage`:

1. **Verificar cooldown en Redis** (5 minutos)
2. **Si pasa cooldown:**
   - Otorgar puntos al usuario
   - ✅ **Actualizar `max_puntos`** si `puntos > max_puntos`
   - ✅ **Registrar/actualizar watchtime** (+5 minutos)
   - Registrar en `HistorialPunto`

Todo dentro de una **transacción única** para máxima consistencia.

## 📊 Archivos Modificados

### Modelos
- ✅ `src/models/usuario.model.js` - Agregado campo `max_puntos`
- ✅ `src/models/userWatchtime.model.js` - **NUEVO**
- ✅ `src/models/index.js` - Importación y asociaciones de `UserWatchtime`

### Controladores
- ✅ `src/controllers/kickWebhook.controller.js` - Lógica de max_puntos y watchtime

### Servicios
- ✅ `src/services/leaderboard.service.js` - Incluir max_puntos y watchtime en respuesta

### Migraciones
- ✅ `migrations/20260103000002-add-max-puntos-to-usuarios.js`
- ✅ `migrations/20260103000003-create-user-watchtime.js`
- ✅ `migrations/manual-apply-max-puntos-watchtime.sql` (aplicación manual)

### Scripts
- ✅ `initialize-watchtime.js` - Inicialización de datos

## ✅ Verificación Post-Implementación

1. **Verificar estructura de BD:**
   ```sql
   DESC usuarios; -- Debe mostrar columna 'max_puntos'
   DESC user_watchtime; -- Debe existir la tabla con su estructura
   ```

2. **Probar webhook:**
   - Enviar mensaje en chat de Kick
   - Verificar en BD:
     ```sql
     SELECT usuario_id, puntos, max_puntos FROM usuarios WHERE id = 3;
     SELECT * FROM user_watchtime WHERE usuario_id = 3;
     ```

3. **Probar endpoint:**
   ```bash
   curl http://localhost:3000/api/leaderboard?limit=10
   ```
   - Debe devolver `max_puntos`, `watchtime_minutes`, `message_count`

4. **Verificar logs:**
   - Buscar logs con `[MAX POINTS]` para confirmación de actualizaciones
   - Buscar logs con `[WATCHTIME]` para confirmación de acumulación

## 🐛 Troubleshooting

### Error: "Column 'max_puntos' doesn't exist"
→ Ejecutar migraciones: `npm run migrate` o script SQL manual

### Error: "Table 'user_watchtime' doesn't exist"
→ Verificar que creó la tabla con: `DESC user_watchtime;`

### Watchtime no se actualiza
→ Verificar en logs que el webhook reciba eventos `chat.message.sent`
→ Confirmar que el cooldown de Redis esté funcionando

### Max_puntos no se actualiza
→ Enviar mensaje en chat y verificar logs `[MAX POINTS]`
→ Confirmar que `puntos > max_puntos` antes de actualizar

## 🚀 Próximas Mejoras Sugeridas

- [ ] Extender snapshots de leaderboard para incluir `max_puntos`
- [ ] Dashboard de estadísticas de watchtime por usuario
- [ ] Premios/logros basados en watchtime acumulado
- [ ] Reset periódico de watchtime (diario/semanal)
- [ ] Gráficos históricos de watchtime vs puntos

---

**Fecha de implementación:** 2026-01-04
**Versión:** 1.0
**Estado:** ✅ Implementado y listo para testear

