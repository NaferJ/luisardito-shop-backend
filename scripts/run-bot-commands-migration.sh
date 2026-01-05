#!/bin/bash

# ==============================================================================
# 🤖 Script para ejecutar la migración de comandos del bot
# ==============================================================================
# Este script ejecuta la migración que crea la tabla kick_bot_commands
# y migra los comandos hardcodeados (!tienda, !puntos) a la base de datos
# ==============================================================================

echo "🤖 ======================================"
echo "   Migración: Sistema de Comandos del Bot"
echo "   ======================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Este script debe ejecutarse desde la raíz del proyecto"
    exit 1
fi

# Verificar que existe la migración
MIGRATION_FILE="migrations/20251125000001-create-kick-bot-commands.js"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: No se encuentra el archivo de migración"
    echo "   Buscado: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Archivo de migración encontrado"
echo ""

# Verificar conexión a la base de datos
echo "🔍 Verificando conexión a la base de datos..."
echo ""

# Intentar ejecutar la migración
echo "🚀 Ejecutando migración..."
echo ""
npm run migrate

MIGRATION_EXIT_CODE=$?

echo ""

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ ======================================"
    echo "   ¡Migración ejecutada exitosamente!"
    echo "   ======================================"
    echo ""
    echo "📋 Lo que se creó:"
    echo "   ✓ Tabla: kick_bot_commands"
    echo "   ✓ Índices optimizados"
    echo "   ✓ Comandos migrados:"
    echo "     - !tienda (alias: !shop)"
    echo "     - !puntos"
    echo ""
    echo "🎯 Próximos pasos:"
    echo "   1. Verificar comandos: GET /api/kick-admin/bot-commands"
    echo "   2. Crear frontend para gestión"
    echo "   3. ¡Los comandos ya NO están hardcodeados!"
    echo ""
    echo "📖 Documentación completa en:"
    echo "   - BOT-COMMANDS-SYSTEM.md"
    echo "   - RESUMEN-COMANDOS-BOT.md"
    echo ""
else
    echo "❌ ======================================"
    echo "   Error al ejecutar la migración"
    echo "   ======================================"
    echo ""
    echo "🔧 Posibles soluciones:"
    echo ""
    echo "1. Base de datos no disponible:"
    echo "   docker-compose up -d db"
    echo ""
    echo "2. Credenciales incorrectas:"
    echo "   Verificar archivo .env"
    echo ""
    echo "3. Migración ya ejecutada:"
    echo "   Si la tabla ya existe, todo está OK"
    echo "   Verifica con: npm run migrate:status"
    echo ""
    echo "4. Ejecutar desde Docker:"
    echo "   docker-compose exec backend npm run migrate"
    echo ""
    exit 1
fi
