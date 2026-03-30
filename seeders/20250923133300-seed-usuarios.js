"use strict";

const bcrypt = require('bcrypt');

// Contraseña por defecto para seeds de desarrollo (NO es producción)
const DEFAULT_SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Change_Me_123!';

module.exports = {
  async up(queryInterface, Sequelize) {
    const hash = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);

    const usuarios = [
      {
        id: 2,
        user_id_ext: null,
        nickname: 'usuario_demo',
        email: 'demo@demo.com',
        password_hash: hash,
        puntos: 1000,
        kick_data: null,
        creado: new Date('2025-08-19 21:01:28'),
        actualizado: new Date('2025-09-14 20:12:49'),
        rol_id: 1
      },
      {
        id: 3,
        user_id_ext: null,
        nickname: 'NaferJ',
        email: 'naferj@demo.com',
        password_hash: hash,
        puntos: 2200000,
        kick_data: null,
        creado: new Date('2025-08-19 21:17:11'),
        actualizado: new Date('2025-09-15 17:43:47'),
        rol_id: 4
      },
      {
        id: 4,
        user_id_ext: null,
        nickname: 'NaferJBot',
        email: 'naferjbot@gmail.com',
        password_hash: hash,
        puntos: 10000,
        kick_data: null,
        creado: new Date('2025-09-15 16:18:43'),
        actualizado: new Date('2025-09-15 16:43:44'),
        rol_id: 1
      },
      {
        id: 5,
        user_id_ext: null,
        nickname: 'Luisardito',
        email: 'luisardito@streamer.com',
        password_hash: null, // Sin password, solo OAuth
        puntos: 0,
        kick_data: null,
        creado: new Date(),
        actualizado: new Date(),
        rol_id: 3 // Rol streamer
      }
    ];

    await queryInterface.bulkInsert('usuarios', usuarios, { ignoreDuplicates: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('usuarios', { id: [2,3,4,5] }, {});
  }
};
