#!/bin/bash
# Script para diagnosticar por qué no se están realizando backups

echo "🔍 DIAGNÓSTICO DE BACKUPS"
echo "========================="
echo ""

echo "📅 1. Últimos backups creados:"
echo "   Local:"
if [ -d "./backups/local" ]; then
    ls -lht ./backups/local | head -5
else
    echo "   ❌ Directorio ./backups/local NO existe"
fi
echo ""
echo "   GitHub:"
if [ -d "./backups/github" ]; then
    ls -lht ./backups/github | grep ".sql.gz" | head -5
else
    echo "   ❌ Directorio ./backups/github NO existe"
fi
echo ""

echo "🐳 2. Variables de entorno del contenedor:"
docker exec luisardito-backend sh -c 'echo "BACKUP_ENABLED=$BACKUP_ENABLED"'
docker exec luisardito-backend sh -c 'echo "BACKUP_TIME=$BACKUP_TIME"'
docker exec luisardito-backend sh -c 'echo "BACKUP_GITHUB_TOKEN=$(if [ -n \"$BACKUP_GITHUB_TOKEN\" ]; then echo \"✅ Configurado\"; else echo \"❌ No configurado\"; fi)"'
docker exec luisardito-backend sh -c 'echo "BACKUP_GITHUB_REPO_URL=$BACKUP_GITHUB_REPO_URL"'
echo ""

echo "📋 3. Logs del contenedor (backups):"
docker logs luisardito-backend 2>&1 | grep -i "backup" | tail -20
echo ""

echo "⏰ 4. Logs del contenedor (scheduler):"
docker logs luisardito-backend 2>&1 | grep -i "scheduler" | tail -10
echo ""

echo "🔄 5. Estado del contenedor:"
docker ps | grep luisardito-backend
echo ""

echo "📦 6. Verificar si node-cron está instalado:"
docker exec luisardito-backend npm list node-cron 2>&1 | grep node-cron || echo "❌ node-cron NO instalado"
echo ""

