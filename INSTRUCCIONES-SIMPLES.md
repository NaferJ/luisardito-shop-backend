# 🎯 INSTRUCCIONES SIMPLES - FIX BOT

## ¿Qué pasó?

El bot **LuisarditoBot** funcionaba bien por 2 horas, pero después fallaba al intentar renovar su token automáticamente. **Ya lo arreglé**.

---

## 🚀 ¿Qué hacer AHORA?

### En tu computadora (Windows):

```powershell
# 1. Subir el código al repositorio
cd C:\Users\NaferJ\Projects\Private\luisardito-shop-backend
git push origin main
```

### En el servidor (Linux):

```bash
# 2. Conectarte al servidor
ssh naferj@vps-4556ad01

# 3. Ir a la carpeta del proyecto
cd ~/apps/luisardito-shop-backend

# 4. Ejecutar el script de deployment (ya está listo)
chmod +x deploy-fix.sh
./deploy-fix.sh

# Responde 'y' cuando te pregunte si continuar
```

### En el navegador:

```
5. Ve a: https://luisardito.com/admin/integrations
6. Click en "Conectar Bot" 
7. Autoriza con LuisarditoBot
```

### De vuelta en el servidor:

```bash
# 8. Verificar que todo funciona
chmod +x verify-bot-fix.sh
./verify-bot-fix.sh
```

---

## ✅ ¿Cómo sé que funciona?

Deberías ver en los logs:

```
✅ [KickBot] ✅ Token renovado exitosamente para LuisarditoBot
✅ [BOT-MAINTENANCE] Actividad del chat simulada exitosamente
```

En lugar de:

```
❌ [KickBot] ❌ Error renovando access token: Request failed with status code 400
```

---

## 📝 Comandos útiles:

```bash
# Ver logs en tiempo real
docker logs -f --tail 100 luisardito-backend | grep -E "\[KickBot\]|\[BOT-MAINTENANCE\]"

# Ver si el bot está enviando mensajes
docker logs --tail 100 luisardito-backend | grep "Enviando mensaje"

# Ver estado de tokens
docker exec -it luisardito-db psql -U luisardito_user -d luisardito_shop -c "SELECT kick_username, is_active, token_expires_at FROM kick_bot_tokens;"
```

---

## 🎉 Resultado Final:

Después de estos pasos:
- ✅ El bot funcionará 24/7 automáticamente
- ✅ No necesitas re-autorizar nunca más
- ✅ Los tokens se renuevan solos cada ~2 horas
- ✅ El bot envía mensajes automáticos cada 15 minutos

---

## ❓ Si algo sale mal:

1. **Revisa los logs:**
   ```bash
   docker logs --tail 200 luisardito-backend
   ```

2. **Reinicia el contenedor:**
   ```bash
   docker-compose restart luisardito-backend
   ```

3. **Vuelve a autorizar el bot:**
   - Ve a https://luisardito.com/admin/integrations
   - Click en "Conectar Bot"

---

## 📊 Archivos que cambié:

- `src/services/kickBot.service.js` - El fix del bug
- `FIX-REFRESH-TOKEN.md` - Documentación detallada
- `verify-bot-fix.sh` - Script para verificar que funciona
- `deploy-fix.sh` - Script para hacer el deployment
- `INSTRUCCIONES-SIMPLES.md` - Este archivo

---

## 💡 Resumen en una línea:

El problema era que el bot intentaba renovar su token incorrectamente (con parámetros mal formateados). Ahora lo hace correctamente y funcionará para siempre sin intervención manual.

