"use strict";

const TIPOS_BASE = [
  "sub_regalada",
  "puntos_ganados",
  "canje_creado",
  "canje_entregado",
  "canje_cancelado",
  "canje_devuelto",
  "historial_evento",
  "sistema",
];

const TIPOS_NUEVOS = [...TIPOS_BASE, "comunidad_respuesta"];

const enumSql = (tipos) => tipos.map((t) => `'${t}'`).join(", ");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE notificaciones MODIFY COLUMN tipo ENUM(${enumSql(
        TIPOS_NUEVOS
      )}) NOT NULL DEFAULT 'sistema' COMMENT 'Tipo de notificación'`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Keep existing reply notifications as generic 'sistema' notifications
    // so the enum can shrink without failing on stored values.
    await queryInterface.sequelize.query(
      "UPDATE notificaciones SET tipo = 'sistema' WHERE tipo = 'comunidad_respuesta'"
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE notificaciones MODIFY COLUMN tipo ENUM(${enumSql(
        TIPOS_BASE
      )}) NOT NULL DEFAULT 'sistema' COMMENT 'Tipo de notificación'`
    );
  },
};
