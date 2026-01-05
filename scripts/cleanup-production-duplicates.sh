#!/bin/bash

echo "🚨 LIMPIEZA URGENTE DE DUPLICADOS EN PRODUCTIVO"
echo "=============================================="
echo ""
echo "⚠️  Se encontraron duplicados masivos:"
echo "    - Usuario 33112734: 2459 registros"
echo "    - Usuario 64617769: 13 registros"
echo ""
echo "🔧 Procediendo a limpiar manteniendo solo el más reciente..."
echo ""

# Paso 1: Hacer backup de la tabla antes de limpiar
echo "1️⃣ Creando backup de seguridad..."
docker exec luisardito-mysql mysqldump -u root -proot luisardito_shop kick_chat_cooldowns > backup_cooldowns_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Backup creado"

# Paso 2: Mostrar estadísticas antes
echo ""
echo "2️⃣ Estadísticas ANTES de la limpieza:"
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
SELECT
    COUNT(*) as total_registros,
    COUNT(DISTINCT kick_user_id) as usuarios_unicos,
    MAX(created_at) as ultimo_registro
FROM kick_chat_cooldowns;
"

# Paso 3: Limpiar duplicados (mantener el más reciente por usuario)
echo ""
echo "3️⃣ Eliminando duplicados (manteniendo el más reciente)..."
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
DELETE t1 FROM kick_chat_cooldowns t1
INNER JOIN kick_chat_cooldowns t2
WHERE t1.kick_user_id = t2.kick_user_id
AND (
    t1.updated_at < t2.updated_at OR
    (t1.updated_at = t2.updated_at AND t1.created_at < t2.created_at) OR
    (t1.updated_at = t2.updated_at AND t1.created_at = t2.created_at AND t1.id < t2.id)
);
"

if [ $? -eq 0 ]; then
    echo "✅ Duplicados eliminados exitosamente"
else
    echo "❌ Error eliminando duplicados"
    exit 1
fi

# Paso 4: Verificar que no quedan duplicados
echo ""
echo "4️⃣ Verificando que no quedan duplicados..."
DUPLICATES=$(docker exec luisardito-mysql mysql -u root -proot luisardito_shop -se "
SELECT COUNT(*) FROM (
    SELECT kick_user_id
    FROM kick_chat_cooldowns
    GROUP BY kick_user_id
    HAVING COUNT(*) > 1
) as dups;
")

if [ "$DUPLICATES" -eq 0 ]; then
    echo "✅ No quedan duplicados"
else
    echo "❌ Aún hay $DUPLICATES usuarios con duplicados"
    echo "Mostrando duplicados restantes:"
    docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
    SELECT kick_user_id, kick_username, COUNT(*) as count
    FROM kick_chat_cooldowns
    GROUP BY kick_user_id
    HAVING COUNT(*) > 1;
    "
    exit 1
fi

# Paso 5: Estadísticas después
echo ""
echo "5️⃣ Estadísticas DESPUÉS de la limpieza:"
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
SELECT
    COUNT(*) as total_registros,
    COUNT(DISTINCT kick_user_id) as usuarios_unicos
FROM kick_chat_cooldowns;
"

# Paso 6: Crear índice UNIQUE
echo ""
echo "6️⃣ Creando índice UNIQUE..."
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
ALTER TABLE kick_chat_cooldowns
ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id);
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Índice UNIQUE creado"
else
    echo "⚠️ Índice ya existe o error creándolo"
fi

# Paso 7: Verificar índice final
echo ""
echo "7️⃣ Verificando índice UNIQUE..."
docker exec luisardito-mysql mysql -u root -proot luisardito_shop -e "
SHOW INDEX FROM kick_chat_cooldowns WHERE Column_name = 'kick_user_id' AND Non_unique = 0;
"

echo ""
echo "✅ LIMPIEZA COMPLETADA"
echo "🎯 La tabla está lista para SELECT FOR UPDATE"
echo "🚀 Ahora puedes reiniciar el backend y probar el cooldown"
echo ""
