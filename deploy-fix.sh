#!/bin/bash

# 🚀 Script de Deployment Rápido - Fix Refresh Token Bot
# Ejecutar en el servidor de producción

set -e  # Salir si hay error

echo "================================================"
echo "🚀 DEPLOYMENT: FIX REFRESH TOKEN BOT"
echo "================================================"
echo ""

echo "📂 Directorio actual:"
pwd
echo ""

echo "1️⃣  Haciendo backup del código actual..."
BACKUP_DIR="backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p backups
cp -r src "backups/${BACKUP_DIR}"
echo "✅ Backup creado en: backups/${BACKUP_DIR}"
echo ""

echo "2️⃣  Obteniendo últimos cambios del repositorio..."
git fetch origin main
echo "✅ Fetch completado"
echo ""

echo "3️⃣  Mostrando cambios que se van a aplicar..."
git log HEAD..origin/main --oneline | head -5
echo ""

read -p "¿Continuar con el pull? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelado"
    exit 1
fi

echo "4️⃣  Aplicando cambios..."
git pull origin main
echo "✅ Código actualizado"
echo ""

echo "5️⃣  Reiniciando contenedor backend..."
docker-compose restart luisardito-backend
echo "⏳ Esperando que el contenedor inicie..."
sleep 10
echo ""

echo "6️⃣  Verificando estado del contenedor..."
if docker ps | grep -q "luisardito-backend"; then
    echo "✅ Contenedor corriendo"
else
    echo "❌ Error: Contenedor NO está corriendo"
    echo "Ver logs: docker logs luisardito-backend"
    exit 1
fi
echo ""

echo "7️⃣  Mostrando logs de inicio..."
docker logs --tail 30 luisardito-backend | grep -E "Servidor escuchando|KickBot|BOT-MAINTENANCE" | tail -10
echo ""

echo "================================================"
echo "✅ DEPLOYMENT COMPLETADO"
echo "================================================"
echo ""
echo "🔄 PRÓXIMO PASO IMPORTANTE:"
echo "   Debes RE-AUTORIZAR el bot para generar un nuevo refresh token válido"
echo ""
echo "   1. Ve a: https://luisardito.com/admin/integrations"
echo "   2. Click en 'Conectar Bot'"
echo "   3. Autoriza con la cuenta LuisarditoBot"
echo ""
echo "📊 Para verificar que todo funciona:"
echo "   ./verify-bot-fix.sh"
echo ""
echo "📝 Para ver logs en tiempo real:"
echo "   docker logs -f --tail 100 luisardito-backend | grep -E '\[KickBot\]|\[BOT-MAINTENANCE\]'"
echo ""
echo "⏰ El primer refresh automático ocurrirá en ~30 minutos"
echo "   (hay un delay inicial para evitar refresh innecesario)"
echo ""

