@echo off
echo 🔧 ARREGLO COMPLETO DEL PROBLEMA DE DUPLICADOS
echo ==============================================
echo.
echo ⚠️  NOTA IMPORTANTE:
echo     Solo limpiamos la tabla de cooldowns de chat
echo     NO se tocan usuarios, productos, ni nada importante
echo.

REM Paso 1: Limpiar duplicados manualmente
echo 1️⃣ Limpiando duplicados en la base de datos...
docker exec luisardito-mysql mysql -u root -ppassword luisardito_shop -e "DELETE t1 FROM kick_chat_cooldowns t1 INNER JOIN kick_chat_cooldowns t2 WHERE t1.id < t2.id AND t1.kick_user_id = t2.kick_user_id;"

if %ERRORLEVEL% EQU 0 (
    echo ✅ Duplicados eliminados exitosamente
) else (
    echo ❌ Error eliminando duplicados
    exit /b 1
)

REM Paso 2: Crear índice UNIQUE
echo.
echo 2️⃣ Creando índice UNIQUE...
docker exec luisardito-mysql mysql -u root -ppassword luisardito_shop -e "ALTER TABLE kick_chat_cooldowns ADD UNIQUE INDEX idx_kick_user_id_unique (kick_user_id);" 2>nul

if %ERRORLEVEL% EQU 0 (
    echo ✅ Índice UNIQUE creado
) else (
    echo ⚠️ Índice ya existe o no se pudo crear
)

REM Paso 3: Verificar estado
echo.
echo 3️⃣ Verificando estado final...
docker exec luisardito-mysql mysql -u root -ppassword luisardito_shop -e "SELECT COUNT(*) as total_cooldowns, COUNT(DISTINCT kick_user_id) as unique_users FROM kick_chat_cooldowns;"

echo.
echo 4️⃣ Verificando índices...
docker exec luisardito-mysql mysql -u root -ppassword luisardito_shop -e "SHOW INDEX FROM kick_chat_cooldowns WHERE Column_name = 'kick_user_id';"

echo.
echo ✅ LIMPIEZA COMPLETADA
echo 🚀 Ahora puedes intentar arrancar el backend:
echo    docker-compose up -d luisardito-backend
echo.
