# 🤖 Mantenimiento Automático del Bot de Kick

## 🎯 Problema
Los tokens de Kick expiran y requieren renovación manual periódica.

## 🛠️ Soluciones Disponibles

### Opción 1: Simular Comando !tienda (Recomendada)
Ejecuta el mismo mensaje que se envía cuando alguien escribe `!tienda` en el chat.

**Ventajas:**
- ✅ Simula actividad real del chat
- ✅ Mantiene el token activo naturalmente
- ✅ No envía spam innecesario

**Archivo:** `simulate-tienda-command.js`

**Comando para cron:**
```bash
# Cada hora, simular !tienda
0 * * * * docker exec luisardito-backend node simulate-tienda-command.js >> /var/log/bot-maintenance.log 2>&1
```

---

### Opción 2: Renovación Simple de Token
Solo renueva el token sin enviar mensajes.

**Ventajas:**
- ✅ Más eficiente (no envía mensajes)
- ✅ Solo mantiene el token activo

**Archivo:** `keep-bot-alive.js`

**Comando para cron:**
```bash
# Cada hora, renovar token
0 * * * * docker exec luisardito-backend node keep-bot-alive.js >> /var/log/bot-maintenance.log 2>&1
```

---

### Opción 3: Mantenimiento Completo (Más Seguro)
Renueva token + limpia tokens expirados + estadísticas.

**Ventajas:**
- ✅ Más completo y robusto
- ✅ Limpia tokens expirados automáticamente
- ✅ Proporciona estadísticas

**Archivo:** `bot-maintenance.js`

**Comando para cron:**
```bash
# Cada hora, mantenimiento completo
0 * * * * docker exec luisardito-backend node bot-maintenance.js >> /var/log/bot-maintenance.log 2>&1
```

---

## 🚀 Instalación

### 1. Elegir una opción
- **Opción 1** es la más recomendada (simula actividad real)

### 2. Configurar Cron Job
```bash
# Editar crontab
crontab -e

# Agregar una de estas líneas (elige una opción):
0 * * * * cd /ruta/a/tu/proyecto && docker exec luisardito-backend node simulate-tienda-command.js >> /var/log/bot-maintenance.log 2>&1
# O
0 * * * * cd /ruta/a/tu/proyecto && docker exec luisardito-backend node keep-bot-alive.js >> /var/log/bot-maintenance.log 2>&1
# O
0 * * * * cd /ruta/a/tu/proyecto && docker exec luisardito-backend node bot-maintenance.js >> /var/log/bot-maintenance.log 2>&1
```

### 3. Verificar Logs
```bash
# Ver logs de mantenimiento
tail -f /var/log/bot-maintenance.log

# Ver logs del bot
docker logs luisardito-backend --tail 50 -f | grep "KickBot\|MAINTENANCE\|SIMULATE"
```

---

## 📋 ¿Cuál Elegir?

- **Si quieres simular actividad real del chat:** `simulate-tienda-command.js`
- **Si solo quieres mantener el token activo:** `keep-bot-alive.js`
- **Si quieres todo + limpieza automática:** `bot-maintenance.js`

---

## 🔧 Configuración Avanzada

### Probar Envío de Mensajes en Mantenimiento
Si quieres que el mantenimiento también pruebe el envío de mensajes, configura:
```bash
export BOT_MAINTENANCE_TEST_SEND=true
```

### Frecuencia Personalizada
```bash
# Cada 30 minutos
*/30 * * * * docker exec luisardito-backend node simulate-tienda-command.js

# Cada 2 horas
0 */2 * * * docker exec luisardito-backend node simulate-tienda-command.js
```

---

## 📊 Monitoreo

### Ver Estado Actual
```bash
# Ver tokens
docker exec luisardito-backend node add-bot-token.js list

# Probar token
docker exec luisardito-backend node -e "const s = require('./src/services/kickBot.service'); s.resolveAccessToken().then(t => console.log(t ? 'OK' : 'FAIL'))"
```

### Alertas Recomendadas
Configura alertas si ves estos logs:
- `[MAINTENANCE] No se pudo obtener token válido`
- `[SIMULATE] Error simulando comando !tienda`
