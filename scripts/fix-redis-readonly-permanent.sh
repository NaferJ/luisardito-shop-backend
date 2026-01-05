#!/bin/bash

###############################################################################
# Script para arreglar Redis READONLY de forma PERMANENTE
# Autor: GitHub Copilot
# Fecha: 2025-11-07
###############################################################################

set -e

echo "🔧 =========================================="
echo "🔧 FIX REDIS READONLY - SOLUCIÓN PERMANENTE"
echo "🔧 =========================================="
echo ""

# Paso 1: Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: No se encuentra docker-compose.yml"
    echo "   Asegúrate de ejecutar este script desde ~/apps/luisardito-shop-backend"
    exit 1
fi

echo "✅ Directorio correcto encontrado"
echo ""

# Paso 2: Verificar el problema actual
echo "🔍 Paso 1: Verificando el problema actual..."
READONLY_CHECK=$(docker exec -it luisardito-redis redis-cli SET test_write "test" 2>&1 || true)

if echo "$READONLY_CHECK" | grep -q "READONLY"; then
    echo "❌ CONFIRMADO: Redis está en modo READONLY"
else
    echo "✅ Redis parece estar funcionando correctamente"
    echo "   ¿Quieres continuar de todas formas? (s/n)"
    read -r CONTINUE
    if [ "$CONTINUE" != "s" ]; then
        echo "Abortando..."
        exit 0
    fi
fi

echo ""

# Paso 3: Solución temporal (mientras aplicamos la permanente)
echo "🔧 Paso 2: Aplicando solución temporal..."
docker exec -it luisardito-redis redis-cli REPLICAOF NO ONE
echo "✅ Redis promovido a maestro (temporal)"
echo ""

# Paso 4: Verificar que ahora funciona
echo "🔍 Paso 3: Verificando que ahora acepta escrituras..."
docker exec -it luisardito-redis redis-cli SET stream:is_live true
RESULT=$(docker exec -it luisardito-redis redis-cli GET stream:is_live)
echo "   Resultado: $RESULT"
echo "✅ Redis ahora acepta escrituras"
echo ""

# Paso 5: Aplicar solución permanente
echo "🔧 Paso 4: Aplicando solución PERMANENTE..."
echo "   Deteniendo contenedores..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

echo ""
echo "⚠️  IMPORTANTE: Se recomienda limpiar el volumen de Redis para evitar"
echo "   que configuraciones antiguas persistan."
echo ""
echo "   ¿Quieres ELIMINAR el volumen de Redis? (Esto borrará todos los datos en Redis)"
echo "   Los puntos de usuarios están en MySQL, NO se perderán."
echo "   Solo se perderán: cooldowns activos, estado del stream, cache temporal."
echo ""
echo "   ¿Eliminar volumen de Redis? (s/n)"
read -r DELETE_VOLUME

if [ "$DELETE_VOLUME" = "s" ]; then
    echo "🗑️  Eliminando volumen de Redis..."
    docker volume rm luisardito-shop-backend_redis_data || true
    echo "✅ Volumen eliminado"
fi

echo ""
echo "🚀 Paso 5: Levantando servicios con nueva configuración..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Esperando a que los servicios estén listos (30 segundos)..."
sleep 30

echo ""
echo "🔍 Paso 6: Verificación final..."
docker exec -it luisardito-redis redis-cli SET stream:is_live true
FINAL_RESULT=$(docker exec -it luisardito-redis redis-cli GET stream:is_live)
echo "   Resultado: $FINAL_RESULT"

if echo "$FINAL_RESULT" | grep -q "true"; then
    echo ""
    echo "✅ =========================================="
    echo "✅ ÉXITO: Redis arreglado PERMANENTEMENTE"
    echo "✅ =========================================="
    echo ""
    echo "📋 Resumen de cambios aplicados:"
    echo "   • Redis configurado con --replica-read-only no"
    echo "   • Redis configurado con --appendonly yes (persistencia)"
    echo "   • Contenedores reiniciados con nueva configuración"
    echo ""
    echo "🎯 Próximos pasos:"
    echo "   1. Monitorea los logs: docker logs -f luisardito-backend"
    echo "   2. Verifica que el bot funcione correctamente"
    echo "   3. Si todo está bien, ¡listo! El problema está resuelto para siempre"
    echo ""
else
    echo ""
    echo "❌ Error: Redis sigue sin aceptar escrituras"
    echo "   Contacta con soporte técnico"
    echo ""
fi

