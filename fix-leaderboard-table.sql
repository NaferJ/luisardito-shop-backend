-- Script para arreglar la tabla leaderboard_snapshots existente
-- Este script corrige los nombres de columnas y agrega las faltantes

USE luisardito_shop;

-- 1. Renombrar la columna 'points' a 'puntos'
ALTER TABLE `leaderboard_snapshots`
CHANGE COLUMN `points` `puntos` INT NOT NULL COMMENT 'Puntos totales del usuario';

-- 2. Renombrar 'created_at' a 'creado'
ALTER TABLE `leaderboard_snapshots`
CHANGE COLUMN `created_at` `creado` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Agregar columna 'nickname' si no existe
ALTER TABLE `leaderboard_snapshots`
ADD COLUMN IF NOT EXISTS `nickname` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Nickname del usuario en ese momento'
AFTER `usuario_id`;

-- 4. Agregar columna 'is_vip' si no existe
ALTER TABLE `leaderboard_snapshots`
ADD COLUMN IF NOT EXISTS `is_vip` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si el usuario era VIP en ese momento'
AFTER `snapshot_date`;

-- 5. Agregar columna 'kick_data' si no existe
ALTER TABLE `leaderboard_snapshots`
ADD COLUMN IF NOT EXISTS `kick_data` JSON NULL COMMENT 'Datos adicionales de Kick (avatar, etc.)'
AFTER `is_vip`;

-- 6. Verificar que todos los índices existen, si no, crearlos
-- Índice para (usuario_id, snapshot_date)
CREATE INDEX IF NOT EXISTS `idx_leaderboard_usuario_date`
ON `leaderboard_snapshots` (`usuario_id`, `snapshot_date`);

-- Índice para snapshot_date
CREATE INDEX IF NOT EXISTS `idx_leaderboard_snapshot_date`
ON `leaderboard_snapshots` (`snapshot_date`);

-- Índice para (position, snapshot_date)
CREATE INDEX IF NOT EXISTS `idx_leaderboard_position_date`
ON `leaderboard_snapshots` (`position`, `snapshot_date`);

-- 7. Verificar la clave foránea, si no existe, crearla
-- Nota: En MySQL 8.0, necesitamos verificar primero si existe
SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = 'luisardito_shop'
    AND TABLE_NAME = 'leaderboard_snapshots'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_leaderboard_usuario'
);

-- Si no existe, crear la FK
SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE `leaderboard_snapshots`
     ADD CONSTRAINT `fk_leaderboard_usuario`
     FOREIGN KEY (`usuario_id`)
     REFERENCES `usuarios` (`id`)
     ON DELETE CASCADE
     ON UPDATE CASCADE',
    'SELECT "Foreign key already exists" AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Verificar la estructura final
SELECT
    '✅ Tabla arreglada exitosamente' AS status,
    COUNT(*) AS total_columns
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'luisardito_shop'
  AND TABLE_NAME = 'leaderboard_snapshots';

-- 9. Mostrar estructura actualizada
DESCRIBE `leaderboard_snapshots`;

-- 10. Mostrar índices
SHOW INDEX FROM `leaderboard_snapshots`;

-- 11. Limpiar datos incorrectos si existen (nicknames vacíos)
-- Esto es opcional pero recomendado
SELECT '🧹 Limpiando datos...' AS status;

-- Si hay registros con nickname vacío, intentar llenarlos desde la tabla usuarios
UPDATE `leaderboard_snapshots` ls
INNER JOIN `usuarios` u ON ls.usuario_id = u.id
SET ls.nickname = u.nickname
WHERE ls.nickname = '' OR ls.nickname IS NULL;

-- 12. Mostrar resumen final
SELECT
    '✅ COMPLETADO' AS status,
    (SELECT COUNT(*) FROM `leaderboard_snapshots`) AS total_snapshots,
    (SELECT COUNT(DISTINCT usuario_id) FROM `leaderboard_snapshots`) AS usuarios_unicos;
