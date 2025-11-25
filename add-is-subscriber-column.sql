-- Script para agregar la columna is_subscriber a leaderboard_snapshots
-- Esta columna almacenará el estado de suscriptor del usuario en cada snapshot

USE luisardito_shop;

-- 1. Agregar la columna is_subscriber después de is_vip
ALTER TABLE `leaderboard_snapshots`
ADD COLUMN `is_subscriber` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si el usuario era suscriptor en ese momento'
AFTER `is_vip`;

-- 2. Actualizar registros existentes con el estado actual de suscriptor desde kick_data
UPDATE `leaderboard_snapshots`
SET `is_subscriber` = CASE
    WHEN JSON_EXTRACT(`kick_data`, '$.is_subscriber') = true THEN 1
    ELSE 0
END
WHERE `kick_data` IS NOT NULL;

-- 3. Verificar la estructura actualizada
SELECT
    '✅ Columna is_subscriber agregada exitosamente' AS status;

-- 4. Mostrar estructura de la tabla
DESCRIBE `leaderboard_snapshots`;

-- 5. Mostrar algunos registros de ejemplo
SELECT
    usuario_id,
    nickname,
    position,
    puntos,
    is_vip,
    is_subscriber,
    snapshot_date
FROM `leaderboard_snapshots`
ORDER BY snapshot_date DESC, position ASC
LIMIT 10;

-- 6. Resumen de datos
SELECT
    COUNT(*) AS total_snapshots,
    COUNT(DISTINCT usuario_id) AS usuarios_unicos,
    SUM(CASE WHEN is_vip = 1 THEN 1 ELSE 0 END) AS snapshots_vip,
    SUM(CASE WHEN is_subscriber = 1 THEN 1 ELSE 0 END) AS snapshots_subscribers,
    SUM(CASE WHEN is_vip = 1 AND is_subscriber = 1 THEN 1 ELSE 0 END) AS snapshots_vip_y_sub
FROM `leaderboard_snapshots`;
