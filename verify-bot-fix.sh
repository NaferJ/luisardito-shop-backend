#!/bin/bash

# 🔍 Script de Verificación del Fix de Refresh Token
# Ejecutar en el servidor de producción

echo "================================================"
echo "🔍 VERIFICACIÓN DEL FIX DE REFRESH TOKEN"
echo "================================================"
echo ""

echo "1️⃣  Verificando que el contenedor está corriendo..."
if docker ps | grep -q "luisardito-backend"; then
    echo "✅ Contenedor luisardito-backend está corriendo"
else
    echo "❌ Contenedor NO está corriendo"
    exit 1
fi
echo ""

echo "2️⃣  Verificando últimos logs del bot (últimos 50 líneas)..."
echo "---------------------------------------------------"
docker logs --tail 50 luisardito-backend | grep -E "\[KickBot\]|\[BOT-MAINTENANCE\]" | tail -20
echo "---------------------------------------------------"
echo ""

echo "3️⃣  Buscando errores de renovación de token..."
ERROR_COUNT=$(docker logs --tail 200 luisardito-backend | grep -c "Error renovando access token: Request failed with status code 400")
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠️  Se encontraron $ERROR_COUNT errores de renovación de token"
    echo "💡 Puede que necesites re-autorizar el bot"
else
    echo "✅ No se encontraron errores de renovación de token"
fi
echo ""

echo "4️⃣  Verificando tokens activos en la base de datos..."
echo "---------------------------------------------------"
docker exec -it luisardito-db psql -U luisardito_user -d luisardito_shop -c "
SELECT
    kick_username,
    is_active,
    token_expires_at,
    CASE
        WHEN token_expires_at > NOW() THEN '✅ Válido'
        ELSE '❌ Expirado'
    END as estado,
    EXTRACT(EPOCH FROM (token_expires_at - NOW()))/3600 as horas_restantes
FROM kick_bot_tokens
ORDER BY updated_at DESC
LIMIT 5;" 2>/dev/null
echo "---------------------------------------------------"
echo ""

echo "5️⃣  Verificando archivo tokens.json..."
if docker exec luisardito-backend test -f /app/tokens/tokens.json; then
    echo "✅ Archivo tokens.json existe"
    echo "Contenido (sin tokens sensibles):"
    docker exec luisardito-backend cat /app/tokens/tokens.json | jq '{username: .username, expiresAt: .expiresAt, hasAccessToken: (.accessToken != null), hasRefreshToken: (.refreshToken != null)}' 2>/dev/null || echo "⚠️  No se pudo parsear el JSON"
else
    echo "⚠️  Archivo tokens.json NO existe"
fi
echo ""

echo "6️⃣  Verificando últimos mensajes enviados exitosamente..."
SUCCESS_COUNT=$(docker logs --tail 100 luisardito-backend | grep -c "Actividad del chat simulada exitosamente")
if [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo "✅ El bot ha enviado $SUCCESS_COUNT mensajes exitosamente recientemente"
    echo "Último mensaje enviado:"
    docker logs --tail 100 luisardito-backend | grep "Enviando mensaje" | tail -1
else
    echo "⚠️  No se encontraron mensajes exitosos recientes"
fi
echo ""

echo "================================================"
echo "📊 RESUMEN"
echo "================================================"
if [ "$ERROR_COUNT" -eq 0 ] && [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo "✅ ¡Todo parece estar funcionando correctamente!"
    echo "✅ El bot está enviando mensajes"
    echo "✅ No hay errores de renovación de token"
else
    echo "⚠️  Atención requerida:"
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "   - Hay errores de renovación de token"
        echo "   - Acción: Re-autorizar el bot en https://luisardito.com/admin/integrations"
    fi
    if [ "$SUCCESS_COUNT" -eq 0 ]; then
        echo "   - No se detectaron mensajes exitosos recientes"
        echo "   - Verifica los logs completos: docker logs luisardito-backend | tail -200"
    fi
fi
echo ""

echo "📝 Para ver logs en tiempo real:"
echo "   docker logs -f --tail 100 luisardito-backend | grep -E '\[KickBot\]|\[BOT-MAINTENANCE\]'"
echo ""

