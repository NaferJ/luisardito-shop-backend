# 🔧 Fix: Problema de Refresh Token del Bot

## 📋 Resumen del Problema

El bot **LuisarditoBot** funcionaba correctamente durante las primeras 2 horas (duración del access token), pero después fallaba al intentar renovar el token con el siguiente error:

```
[KickBot] ❌ Error renovando access token: Request failed with status code 400
```

## 🐛 Causa del Problema

El método de renovación de tokens estaba usando:
- ❌ `Content-Type: application/json` (incorrecto)
- ❌ Parámetro `scope` en la renovación (no debe incluirse)

Según la especificación OAuth2 y la API de Kick:
- ✅ Debe usar `Content-Type: application/x-www-form-urlencoded`
- ✅ NO debe incluir `scope` al renovar (el refresh token ya tiene los scopes)

## 🛠️ Cambios Realizados

### Archivo: `src/services/kickBot.service.js`

**Método `refreshToken()` - Líneas 33-40:**
```javascript
// ❌ ANTES (incorrecto):
const response = await axios.post('https://id.kick.com/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: tokenRecord.refresh_token,
    client_id: config.kickBot.clientId,
    client_secret: config.kickBot.clientSecret,
    scope: 'user:read chat:write channel:read channel:write'  // ❌ NO debe incluirse
}, {
    headers: { 'Content-Type': 'application/json' }  // ❌ Tipo incorrecto
});

// ✅ DESPUÉS (correcto):
const response = await axios.post('https://id.kick.com/oauth/token', 
    new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRecord.refresh_token,
        client_id: config.kickBot.clientId,
        client_secret: config.kickBot.clientSecret
        // NO incluir scope al renovar - el refresh token ya tiene los scopes
    }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
```

**Método `refreshAccessToken()` - Líneas 478-486:**
Mismo cambio aplicado para mantener consistencia.

**Mejora adicional:**
Ahora cuando se renueva el token desde la DB, también se sincroniza automáticamente `tokens.json` para mantener ambos en sync.

## 🚀 Despliegue a Producción

### 1. Backup del código actual (recomendado):
```bash
cd ~/apps/luisardito-shop-backend
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Subir el código actualizado:
```bash
git add src/services/kickBot.service.js
git commit -m "fix: Corregir refresh token del bot (usar URLSearchParams y sin scope)"
git push origin main
```

### 3. Actualizar producción:
```bash
# En el servidor de producción
cd ~/apps/luisardito-shop-backend
git pull origin main
docker-compose restart luisardito-backend
```

### 4. Re-autorizar el bot (IMPORTANTE):
Como el refresh token actual está marcado como inválido, necesitas re-autorizar el bot:

1. Ve a: `https://luisardito.com/admin/integrations`
2. Click en "Conectar Bot" nuevamente
3. Autoriza con la cuenta **LuisarditoBot**
4. Esto generará un nuevo refresh token válido

## ✅ Verificación

Después del despliegue, monitorea los logs:

```bash
docker logs -f --tail 100 luisardito-backend | grep -E "\[KickBot\]|BOT-MAINTENANCE"
```

Deberías ver:
```
✅ [KickBot] ✅ Token renovado exitosamente para LuisarditoBot
✅ [BOT-MAINTENANCE] Actividad del chat simulada exitosamente
```

En lugar de:
```
❌ [KickBot] ❌ Error renovando access token: Request failed with status code 400
```

## 📊 Comportamiento Esperado

### Ciclo de vida del token:
1. **0-2h**: Usa el access token inicial ✅
2. **~2h**: El sistema detecta que el token expira pronto
3. **2h+**: Renueva automáticamente usando refresh token ✅
4. **Cada 15min**: Verifica y renueva si es necesario ✅
5. **Indefinido**: El bot sigue funcionando sin intervención manual ✅

### Sincronización:
- Base de datos (PostgreSQL) ↔️ tokens.json
- Ambos se mantienen en sync automáticamente

## 🔍 Debug

Si sigue fallando después del fix:

```bash
# Ver logs detallados del refresh
docker logs --tail 200 luisardito-backend | grep -A 10 "Renovando access token"

# Ver contenido de tokens.json
docker exec luisardito-backend cat /app/tokens/tokens.json

# Ver tokens en la DB
docker exec -it luisardito-db psql -U luisardito_user -d luisardito_shop -c "SELECT kick_username, is_active, token_expires_at FROM kick_bot_tokens ORDER BY updated_at DESC LIMIT 5;"
```

## 📝 Notas Importantes

1. **No necesitas re-autorizar cada 2 horas**: El refresh token se renueva automáticamente
2. **Tokens.json y DB están sincronizados**: Cambios en uno se reflejan en el otro
3. **Fallback automático**: Si tokens.json falla, usa la DB y viceversa
4. **Delay inicial de 30 minutos**: Para evitar refresh innecesario justo después de autorizar

## 🎯 Resultado Final

✅ El bot funcionará 24/7 sin necesidad de re-autorización manual
✅ Tokens se renuevan automáticamente cada ~2 horas
✅ Mensajes automáticos del bot cada 15 minutos
✅ Sistema resiliente con múltiples capas de fallback

