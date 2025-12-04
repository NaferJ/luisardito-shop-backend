# 🔄 Sistema de Sincronización Automática de Usernames

## 📋 Resumen

Sistema implementado para mantener sincronizados los usernames de los usuarios cuando cambian su nombre en Kick, sin impacto en el rendimiento.

---

## 🎯 ¿Qué hace?

Cuando un usuario cambia su nombre en Kick, el sistema detecta automáticamente el cambio y actualiza la base de datos **sin intervención manual**.

---

## ⚡ Estrategia de Sincronización

### **Eventos de Chat** (`chat.message.sent`)
- ✅ Sincronización **CON throttling de 24 horas**
- ⚡ Ultra-rápido: solo 1 GET de Redis por mensaje
- 🔒 Actualiza máximo **1 vez cada 24 horas por usuario**
- 📊 Cero impacto en rendimiento (Redis < 1ms)

### **Eventos Importantes** (Poco frecuentes)
- ✅ Sincronización **SIN throttling** (siempre actualiza)
- 📌 Eventos:
  - `channel.followed`
  - `channel.subscription.new`
  - `channel.subscription.renewal`
  - `channel.subscription.gifts` (gifter y giftees)
  - `kicks.gifted`

---

## 🛡️ Protecciones Implementadas

### 1. **Prevención de Colisiones**
```javascript
// Si el nuevo nombre ya existe en otro usuario, NO actualiza
const colision = await Usuario.findOne({
    where: { 
        nickname: kickUsername,
        id: { [Op.ne]: usuario.id }
    }
});
```

**Resultado:** Evita duplicados y conflictos.

### 2. **Throttling con Redis**
```javascript
// Solo permite actualizar cada 24 horas (en eventos de chat)
const syncKey = `username_sync:${kickUserId}`;
await redis.set(syncKey, timestamp, 'EX', 86400);
```

**Resultado:** Previene actualizaciones innecesarias.

### 3. **Fallback Resiliente**
- Si Redis falla → continúa sin throttling
- Si la BD falla → registra error y continúa el webhook
- No rompe el flujo de otorgamiento de puntos

---

## 📊 Impacto en Rendimiento

| Evento | Queries Extra | Tiempo Aprox. | Frecuencia |
|--------|--------------|---------------|------------|
| **Chat Message** | 1 GET Redis + 0-2 queries SQL* | < 2ms | Alta (1000/min) |
| **Follow/Sub/Gift** | 0-2 queries SQL* | < 10ms | Baja (< 10/hora) |

_*Solo hace queries SQL si detecta cambio de nombre_

**Conclusión:** Impacto **insignificante** en rendimiento.

---

## 📝 Logs de Monitoreo

### Logs Normales (sin cambio)
```
[Username Sync] Cambio detectado: "old_name" → "new_name" (ID: 123456)
[Username Sync] ⏰ Última sincronización hace 12.3h - Throttling activo (24h)
```

### Logs de Actualización Exitosa
```
[Username Sync] Cambio detectado: "old_name" → "new_name" (ID: 123456)
[Username Sync] ✅ Usuario ID 42 actualizado: "old_name" → "new_name"
[Username Sync] 📅 Throttling activado por 24h para usuario 123456
```

### Logs de Colisión
```
[Username Sync] Cambio detectado: "old_name" → "new_name" (ID: 123456)
[Username Sync] ⚠️ COLISIÓN: "new_name" ya existe (usuario ID: 99)
```

### Logs de Error
```
[Username Sync] ❌ Error sincronizando username: [mensaje de error]
```

---

## 🔍 Cómo Monitorear

### 1. **Ver cambios de username en logs**
```bash
grep "Username Sync.*actualizado" logs/combined.log
```

### 2. **Ver colisiones**
```bash
grep "COLISIÓN" logs/combined.log
```

### 3. **Ver throttling activo**
```bash
grep "Throttling activo" logs/combined.log
```

### 4. **Ver keys de Redis**
```bash
redis-cli KEYS "username_sync:*"
```

### 5. **Ver TTL de un usuario específico**
```bash
redis-cli TTL "username_sync:123456789"
```

---

## 🧪 Casos de Uso

### Caso 1: Usuario cambia nombre y chatea
1. Usuario cambia de "player1" a "player2" en Kick
2. Usuario envía mensaje en chat
3. Sistema detecta cambio → actualiza → activa throttling 24h
4. **Resultado:** Nombre actualizado, siguientes mensajes no verifican cambio

### Caso 2: Usuario cambia nombre y hace follow
1. Usuario cambia de "gamer123" a "progamer123"
2. Usuario hace follow al canal
3. Sistema detecta cambio → actualiza sin throttling
4. **Resultado:** Nombre actualizado inmediatamente

### Caso 3: Usuario cambia a nombre que ya existe
1. Usuario A se llama "streamer1"
2. Usuario A cambia a "streamer2" en Kick
3. Usuario B ya se llama "streamer2" en la BD
4. Usuario A envía mensaje
5. Sistema detecta colisión → NO actualiza → registra warning
6. **Resultado:** Usuario A mantiene "streamer1" hasta que el conflicto se resuelva

### Caso 4: Redis caído
1. Redis no responde
2. Sistema registra warning
3. Continúa sin throttling (actualiza siempre)
4. **Resultado:** Sistema resiliente, funciona sin Redis

---

## 🔧 Archivos Modificados

### Nuevo Archivo
- `src/utils/usernameSync.util.js` - Helper de sincronización

### Archivos Modificados
- `src/controllers/kickWebhook.controller.js` - Integración en webhooks

### Funciones Afectadas
- `handleChatMessage()` - Con throttling 24h
- `handleFollow()` - Sin throttling
- `handleNewSubscription()` - Sin throttling
- `handleSubscriptionRenewal()` - Sin throttling
- `handleSubscriptionGifts()` - Sin throttling (gifter y giftees)
- `handleKicksGifted()` - Sin throttling

---

## 🚀 Endpoint Manual (ya existente)

Los usuarios también pueden forzar sincronización desde el frontend:

```javascript
POST /api/usuarios/sync-kick-info
Authorization: Bearer <token>
```

Este endpoint **siempre actualiza** (ignora throttling).

---

## ✅ Ventajas del Sistema

1. ✅ **Sincronización automática** - Sin intervención manual
2. ⚡ **Cero impacto en rendimiento** - Redis ultra-rápido
3. 🛡️ **Previene colisiones** - No permite duplicados
4. 🔄 **Resiliente** - Funciona aunque Redis falle
5. 📊 **Monitoreable** - Logs claros y detallados
6. 🎯 **Inteligente** - Throttling solo donde es necesario

---

## 🔐 Garantías

- ✅ **Nunca rompe el flujo de puntos** - Si falla, solo registra error
- ✅ **Nunca crea duplicados** - Valida colisiones antes de actualizar
- ✅ **Siempre usa `user_id_ext` para identificar** - Username es solo display
- ✅ **Backward compatible** - No afecta código existente

---

## 📈 Próximos Pasos (Opcional)

Si quieres más control, puedes agregar:

1. **Dashboard de sincronizaciones**
   - Ver cambios de nombre en tiempo real
   - Estadísticas de colisiones
   - Usuarios con nombres desactualizados

2. **Notificaciones**
   - Alertar cuando hay colisiones
   - Notificar cambios de nombre importantes

3. **Configuración dinámica**
   - Ajustar throttling desde admin panel
   - Habilitar/deshabilitar por evento

---

## 🆘 Solución de Problemas

### Problema: Nombre no se actualiza
**Causa:** Throttling activo (usuario chateó hace < 24h)
**Solución:** Esperar 24h o usar endpoint manual `/sync-kick-info`

### Problema: Warning de colisión
**Causa:** Otro usuario ya tiene ese nombre
**Solución:** 
- Contactar usuarios involucrados
- Resolver manualmente en BD
- Usuario debe elegir otro nombre en Kick

### Problema: Muchos warnings de Redis
**Causa:** Redis caído o lento
**Solución:** Sistema funciona sin Redis, pero verificar estado del servicio

---

## 📞 Contacto

Para dudas o mejoras, revisar:
- Logs en `logs/combined.log`
- Redis keys: `redis-cli KEYS "username_sync:*"`
- Código: `src/utils/usernameSync.util.js`
