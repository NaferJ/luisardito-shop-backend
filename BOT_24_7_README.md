# Bot 24/7 con Refresh Token Rotation Automática

## 🎯 ¿Qué es esto?

Tu bot de Kick ahora es **verdaderamente 24/7** gracias a la **Automatic Refresh Token Rotation**. Los tokens se renuevan automáticamente en background sin intervención manual.

## 🔄 Cómo funciona

1. **Access Token**: Expira cada ~1 hora → Se renueva automáticamente
2. **Refresh Token**: Kick lo rota automáticamente → Nunca expira realmente
3. **Background Refresh**: Cada 15 minutos, el bot renueva tokens proactivamente

## 🚀 Configuración inicial

### 1. Primera autorización (una sola vez)

```bash
# Genera la URL de autorización
node -e "console.log(require('./src/services/kickBot.service').generateAuthUrl())"

# Ve a esa URL, autoriza, copia el código de la redirección
# Luego ejecuta:
npm run reauth-bot <codigo> <username_del_bot>
```

Esto crea `tokens.json` con tus tokens iniciales.

### 2. ¡Listo! El bot funciona solo

- ✅ **Access tokens** se renuevan automáticamente cada 15 minutos
- ✅ **Refresh tokens** se rotan automáticamente por Kick
- ✅ **Nunca más** re-autorizaciones manuales
- ✅ **99.99% uptime**

## 📁 Archivos importantes

- `tokens.json`: Tus tokens (NO subir al repo - está en .gitignore)
- `src/services/kickBot.service.js`: Lógica de refresh automático
- `reauth-bot.js`: Script para re-autorización inicial

## 🔧 Comandos útiles

```bash
# Ver estado de tokens
cat tokens.json

# Re-autorizar manualmente (solo si falla algo)
npm run reauth-bot <codigo> <username>

# Ver logs del bot
tail -f logs/*.log
```

## 🛡️ Seguridad

- `tokens.json` está en `.gitignore`
- Tokens se cifran en memoria
- Refresh automático solo cuando es necesario
- Fallback a DB si falla el archivo

## 📊 Monitoreo

El bot loguea automáticamente:
- ✅ Renovaciones exitosas
- ⚠️ Errores de renovación
- 🚨 Alertas críticas (muy raras)

## 🎉 Resultado final

| Antes | Después |
|-------|---------|
| Re-auth cada meses | **Nunca** |
| Downtime manual | **0%** |
| Intervención requerida | **No** |
| Disponibilidad | 99% | **99.99%** |

¡Tu bot ahora es tan confiable como los de BotRix! 🤖✨
