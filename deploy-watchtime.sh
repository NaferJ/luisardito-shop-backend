#!/usr/bin/env bash

# Script de despliegue para aplicar migraciones y inicializar watchtime
# Ejecutar en el contenedor de la aplicación

set -e

echo "🚀 Iniciando despliegue de Max Points y Watchtime..."
echo ""

# 1. Aplicar migraciones
echo "📊 1. Aplicando migraciones de base de datos..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm run migrate

if [ $? -eq 0 ]; then
    echo "✅ Migraciones aplicadas exitosamente"
else
    echo "❌ Error aplicando migraciones"
    exit 1
fi

echo ""

# 2. Inicializar datos de watchtime
echo "📝 2. Inicializando datos de watchtime para usuarios existentes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node initialize-watchtime.js

if [ $? -eq 0 ]; then
    echo "✅ Datos de watchtime inicializados"
else
    echo "❌ Error inicializando watchtime"
    exit 1
fi

echo ""

# 3. Verificar implementación
echo "🔍 3. Verificando implementación..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node verify-implementation.js

if [ $? -eq 0 ]; then
    echo "✅ Implementación verificada correctamente"
else
    echo "⚠️  Verificación completada con algunos avisos"
fi

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "📋 Próximas acciones:"
echo "   1. Reiniciar servidor: docker-compose restart luisardito-backend"
echo "   2. Ver logs: docker-compose logs -f luisardito-backend"
echo "   3. Probar API: curl http://localhost:3000/api/leaderboard?limit=5"
echo "   4. Enviar mensaje en Kick y verificar logs con [MAX POINTS] y [WATCHTIME]"
echo ""

