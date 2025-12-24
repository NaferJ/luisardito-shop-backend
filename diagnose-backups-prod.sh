#!/bin/bash

echo "🔍 Diagnóstico de Backups en Producción"
echo "========================================"
echo ""

echo "📋 1. Variables de Entorno:"
echo "   BACKUP_ENABLED: ${BACKUP_ENABLED:-❌ No configurada}"
echo "   BACKUP_TIME: ${BACKUP_TIME:-❌ No configurada}"
echo "   BACKUP_GITHUB_TOKEN: ${BACKUP_GITHUB_TOKEN:+✅ Configurado}"
echo "   BACKUP_GITHUB_REPO_URL: ${BACKUP_GITHUB_REPO_URL:-❌ No configurada}"
echo "   BACKUP_GITHUB_USER_EMAIL: ${BACKUP_GITHUB_USER_EMAIL:-❌ No configurada}"
echo ""

echo "📁 2. Directorios:"
if [ -d "/app/backups/local" ]; then
    echo "   ✅ /app/backups/local existe"
    echo "   Archivos: $(ls -1 /app/backups/local 2>/dev/null | wc -l)"
    echo "   Último backup local: $(ls -t /app/backups/local | head -1)"
else
    echo "   ❌ /app/backups/local NO existe"
fi

if [ -d "/app/backups/github" ]; then
    echo "   ✅ /app/backups/github existe"
    if [ -d "/app/backups/github/.git" ]; then
        echo "   ✅ Repositorio Git inicializado"
    else
        echo "   ❌ Repositorio Git NO inicializado"
    fi
else
    echo "   ❌ /app/backups/github NO existe"
fi
echo ""

echo "🐳 3. Contenedor MySQL:"
if docker ps | grep -q "luisardito-mysql"; then
    echo "   ✅ Contenedor MySQL corriendo"
else
    echo "   ❌ Contenedor MySQL NO encontrado"
fi
echo ""

echo "⏰ 4. Proceso Cron/Scheduler:"
echo "   Buscando procesos node relacionados con backup..."
ps aux | grep -i backup | grep -v grep || echo "   ❌ No se encontraron procesos de backup"
echo ""

echo "📊 5. Estado del Repositorio GitHub:"
if [ -d "/app/backups/github/.git" ]; then
    cd /app/backups/github
    echo "   Último commit:"
    git log -1 --oneline --date=short --format="   %ad: %s" 2>/dev/null || echo "   ❌ Error leyendo commits"

    echo "   Estado del repositorio:"
    git status --porcelain 2>/dev/null | head -5 || echo "   ❌ Error verificando estado"

    echo "   Remote URL:"
    git remote get-url origin 2>/dev/null | sed 's/x-access-token:[^@]*/x-access-token:***/' || echo "   ❌ Sin remote"
else
    echo "   ❌ Repositorio no inicializado"
fi
echo ""

echo "📝 6. Logs recientes (últimas 20 líneas sobre backups):"
if [ -f "/app/logs/app.log" ]; then
    grep -i backup /app/logs/app.log | tail -20 || echo "   Sin logs de backup en /app/logs/app.log"
else
    echo "   ⚠️  Archivo de log no encontrado en /app/logs/app.log"
    echo "   Intentando ver logs del contenedor..."
    docker logs luisardito-backend 2>&1 | grep -i backup | tail -20 || echo "   Sin logs de backup"
fi
echo ""

echo "🔧 7. Test de conectividad Git:"
if command -v git >/dev/null 2>&1; then
    echo "   ✅ Git instalado: $(git --version)"

    if [ -d "/app/backups/github/.git" ]; then
        cd /app/backups/github
        echo "   Probando git fetch..."
        timeout 10 git fetch origin main 2>&1 | head -5 || echo "   ❌ Error en git fetch"
    fi
else
    echo "   ❌ Git NO instalado"
fi
echo ""

echo "🎯 Diagnóstico completado"
echo ""
echo "💡 Comandos sugeridos para ejecutar en producción:"
echo "   1. Ver variables de entorno del contenedor:"
echo "      docker exec luisardito-backend env | grep BACKUP"
echo ""
echo "   2. Ver logs en tiempo real:"
echo "      docker logs -f luisardito-backend | grep -i backup"
echo ""
echo "   3. Ejecutar backup manual:"
echo "      docker exec -it luisardito-backend node manual-backup.js"

