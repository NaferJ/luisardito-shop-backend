-- Script para crear la tabla leaderboard_snapshots manualmente
-- Ejecutar si la migración de Sequelize falla

USE luisardito_shop;

-- Eliminar tabla si existe (opcional, comentar si no quieres perder datos)
-- DROP TABLE IF EXISTS `leaderboard_snapshots`;

-- Crear tabla leaderboard_snapshots
CREATE TABLE IF NOT EXISTS `leaderboard_snapshots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `nickname` VARCHAR(255) NOT NULL COMMENT 'Nickname del usuario en ese momento',
  `puntos` INT NOT NULL COMMENT 'Puntos totales del usuario',
  `position` INT NOT NULL COMMENT 'Posición en el ranking (1 = primero)',
  `snapshot_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora del snapshot',
  `is_vip` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si el usuario era VIP en ese momento',
  `kick_data` JSON NULL COMMENT 'Datos adicionales de Kick (avatar, etc.)',
  `creado` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_leaderboard_usuario_date` (`usuario_id`, `snapshot_date`),
  INDEX `idx_leaderboard_snapshot_date` (`snapshot_date`),
  INDEX `idx_leaderboard_position_date` (`position`, `snapshot_date`),
  CONSTRAINT `fk_leaderboard_usuario`
    FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar registro en SequelizeMeta para marcar la migración como ejecutada
INSERT INTO `SequelizeMeta` (`name`)
VALUES ('20250128000001-create-leaderboard-snapshots.js')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Verificar que la tabla se creó correctamente
SELECT
  'Tabla creada exitosamente' AS status,
  COUNT(*) AS total_columns
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'luisardito_shop'
  AND TABLE_NAME = 'leaderboard_snapshots';

-- Mostrar estructura de la tabla
DESCRIBE `leaderboard_snapshots`;

-- Mostrar índices creados
SHOW INDEX FROM `leaderboard_snapshots`;
