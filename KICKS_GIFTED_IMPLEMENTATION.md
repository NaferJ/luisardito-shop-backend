# Implementación de Soporte para Kicks Gifted

## Fecha: 2025-11-10

## Resumen
Se agregó soporte completo para el evento `kicks.gifted` de Kick, que permite otorgar puntos a los usuarios cuando regalan kicks en el canal.

## Cambios Implementados

### 1. Handler del Evento `handleKicksGifted()` ✅
**Archivo:** `src/controllers/kickWebhook.controller.js`

Se implementó el handler completo que:
- Extrae información del evento (sender, amount, gift details)
- Verifica que el usuario existe en la BD
- Otorga puntos equivalentes a la cantidad de kicks regalados
- Registra la transacción en el historial de puntos
- Actualiza las estadísticas del usuario en `kick_user_tracking`

**Características:**
- **Puntos otorgados:** Equivalente a la cantidad de kicks regalados (1 kick = 1 punto)
- **Transacciones atómicas:** Usa transacciones de Sequelize para garantizar consistencia
- **Logging completo:** Registra toda la actividad y errores
- **Historial completo:** Guarda los datos del evento en `kick_event_data`

### 2. Actualización del Switch de Eventos ✅
**Archivo:** `src/controllers/kickWebhook.controller.js`

Se agregó el case `'kicks.gifted'` en la función `processWebhookEvent()`:
```javascript
case 'kicks.gifted':
    await handleKicksGifted(payload, metadata);
    break;
```

### 3. Migración de Base de Datos ✅
**Archivo:** `migrations/20251110000001-add-total-kicks-gifted-to-kick-user-tracking.js`

Se creó una migración que agrega el campo `total_kicks_gifted` a la tabla `kick_user_tracking`:
- **Tipo:** INTEGER
- **Default:** 0
- **Comentario:** "Cantidad total de kicks regalados por el usuario"

### 4. Actualización del Modelo ✅
**Archivo:** `src/models/kickUserTracking.model.js`

Se agregó el campo `total_kicks_gifted` al modelo de Sequelize para mantener estadísticas.

## Flujo del Evento

```
1. Webhook recibe evento kicks.gifted
   ↓
2. Verifica firma y guarda en kick_webhook_events
   ↓
3. Procesa evento en handleKicksGifted()
   ↓
4. Verifica usuario en BD
   ↓
5. Inicia transacción
   ↓
6. Incrementa puntos del usuario (amount de kicks)
   ↓
7. Registra en historial_puntos con concepto: "Regalo de X kicks (Gift Name)"
   ↓
8. Actualiza kick_user_tracking.total_kicks_gifted
   ↓
9. Commit de transacción
   ↓
10. Log de éxito con total de puntos actualizado
```

## Estructura del Payload de Kick

Según la documentación oficial de Kick:
```json
{
  "broadcaster": {
    "user_id": 123456789,
    "username": "broadcaster_name",
    "is_verified": true,
    "profile_picture": "https://...",
    "channel_slug": "broadcaster_channel"
  },
  "sender": {
    "user_id": 987654321,
    "username": "gift_sender",
    "is_verified": false,
    "profile_picture": "https://...",
    "channel_slug": "gift_sender_channel"
  },
  "gift": {
    "amount": 100,
    "name": "Full Send",
    "type": "BASIC",
    "tier": "BASIC",
    "message": "w"
  },
  "created_at": "2025-10-20T04:00:08.634Z"
}
```

## Datos Guardados en Historial

```json
{
  "event_type": "kicks.gifted",
  "kick_user_id": "987654321",
  "kick_username": "gift_sender",
  "kick_amount": 100,
  "gift_name": "Full Send",
  "gift_tier": "BASIC",
  "gift_message": "w",
  "created_at": "2025-10-20T04:00:08.634Z"
}
```

## Pasos para Activar

### 1. Ejecutar Migración
```bash
# Dentro del contenedor Docker
docker exec luisardito-backend npx sequelize-cli db:migrate --migrations-path migrations --config sequelize.config.js

# O localmente (si la BD es accesible)
npx sequelize-cli db:migrate --migrations-path migrations --config sequelize.config.js
```

### 2. Reiniciar el Backend
```bash
docker-compose restart api
```

### 3. Verificar Suscripción al Evento
El evento `kicks.gifted` debe estar suscrito en Kick. Verificar con:
```bash
curl https://api.luisardito.com/api/kick-webhook/debug
```

Si no está suscrito, el usuario broadcaster debe autenticarse nuevamente para que se cree la suscripción automáticamente.

## Logs Esperados

Cuando se recibe un kick gifted:
```
[Kick Webhook] Procesando evento kicks.gifted
[Kick Webhook][Kicks Gifted] {
  broadcaster: 'Luisardito',
  sender: 'usuario123',
  kick_amount: 100,
  gift_name: 'Full Send',
  gift_tier: 'BASIC',
  message: 'w',
  created_at: '2025-10-20T04:00:08.634Z'
}
[Kick Webhook][Kicks Gifted] ✅ 100 puntos otorgados a usuario123 por regalar 100 kicks
[Kick Webhook][Kicks Gifted] 💰 Total puntos de usuario123: 1250
```

## Testing

Para probar el evento sin esperar un kick real:

### 1. Simular Webhook Completo
Usar el endpoint de simulación (si existe) o crear uno temporal.

### 2. Verificar en Base de Datos
```sql
-- Ver historial de kicks gifted
SELECT * FROM historial_puntos 
WHERE concepto LIKE '%Regalo de%kicks%' 
ORDER BY fecha_hora DESC 
LIMIT 10;

-- Ver estadísticas de usuario
SELECT kick_username, total_kicks_gifted 
FROM kick_user_tracking 
WHERE total_kicks_gifted > 0;
```

## Comparación con Suscripciones

| Característica | Suscripciones | Kicks Gifted |
|----------------|---------------|--------------|
| Puntos | Configurables en `kick_points_config` | Equivalente al amount de kicks |
| Tracking | `is_subscribed`, `subscription_expires_at` | `total_kicks_gifted` |
| Historial | Concepto: "Nueva suscripción (X meses)" | Concepto: "Regalo de X kicks (Gift Name)" |
| Multiplicador VIP | Deshabilitado temporalmente | No aplica |

## Notas Importantes

1. **No hay configuración de puntos**: A diferencia de las suscripciones, los puntos otorgados son **directamente el amount de kicks**, no hay un multiplicador configurable.

2. **El usuario debe existir en la BD**: Si el usuario que regala kicks no está registrado, el evento se ignora con un log informativo.

3. **Transacciones atómicas**: Todo el proceso (incremento de puntos, historial, tracking) se hace en una sola transacción para evitar inconsistencias.

4. **Estadísticas opcionales**: El campo `total_kicks_gifted` es opcional pero útil para rankings y estadísticas futuras.

## Próximos Pasos

- [ ] Ejecutar la migración en producción
- [ ] Verificar que la suscripción al evento esté activa
- [ ] Monitorear logs cuando se reciba el primer kick gifted
- [ ] Considerar agregar endpoints de estadísticas para mostrar top kick gifters
- [ ] Evaluar si se quiere agregar un multiplicador configurable en el futuro

## Archivos Modificados

1. ✅ `src/controllers/kickWebhook.controller.js` - Handler del evento
2. ✅ `src/models/kickUserTracking.model.js` - Campo total_kicks_gifted
3. ✅ `src/services/kickAutoSubscribe.service.js` - Evento agregado a DEFAULT_EVENTS
4. ✅ `src/services/kickAppToken.service.js` - Evento agregado a lista de suscripciones
5. ✅ `migrations/20251110000001-add-total-kicks-gifted-to-kick-user-tracking.js` - Migración de BD
6. ✅ `KICKS_GIFTED_IMPLEMENTATION.md` - Este archivo de documentación

---

**Implementado por:** GitHub Copilot  
**Fecha:** 2025-11-10  
**Estado:** ✅ COMPLETO - Listo para desplegar (pendiente solo de ejecutar migración)

