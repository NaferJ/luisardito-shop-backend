"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("community_posts", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        comment: "Autor del post",
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: "Título del post",
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Contenido del post",
      },
      media: {
        type: Sequelize.JSON,
        allowNull: true,
        comment:
          "Adjuntos Cloudinary: [{type: image|video, url, thumbnail_url, width, height}]",
      },
      pinned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Fijado por un moderador",
      },
      status: {
        type: Sequelize.ENUM("visible", "pending_review", "hidden"),
        allowNull: false,
        defaultValue: "visible",
        comment: "Estado de moderación",
      },
      view_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: "Vistas únicas aproximadas (deduplicadas vía Redis)",
      },
      hidden_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        comment: "Usuario que ocultó el post (autor o moderador)",
      },
      hidden_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      hidden_reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex("community_posts", ["usuario_id"], {
      name: "idx_community_posts_usuario",
    });
    await queryInterface.addIndex(
      "community_posts",
      ["status", "pinned", "creado"],
      { name: "idx_community_posts_feed" }
    );

    await queryInterface.createTable("community_comments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "community_posts", key: "id" },
        onDelete: "CASCADE",
        comment: "Post al que pertenece el comentario",
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        comment: "Autor del comentario",
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Contenido del comentario",
      },
      status: {
        type: Sequelize.ENUM("visible", "pending_review", "hidden"),
        allowNull: false,
        defaultValue: "visible",
        comment: "Estado de moderación",
      },
      hidden_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
      },
      hidden_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      hidden_reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex("community_comments", ["post_id", "status"], {
      name: "idx_community_comments_post",
    });
    await queryInterface.addIndex("community_comments", ["usuario_id"], {
      name: "idx_community_comments_usuario",
    });

    await queryInterface.createTable("community_likes", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        comment: "Usuario que dio like",
      },
      target_type: {
        type: Sequelize.ENUM("post", "comment"),
        allowNull: false,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "ID del post o comentario (polimórfico, sin FK)",
      },
      creado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex(
      "community_likes",
      ["usuario_id", "target_type", "target_id"],
      { unique: true, name: "uq_community_likes_user_target" }
    );
    await queryInterface.addIndex(
      "community_likes",
      ["target_type", "target_id"],
      { name: "idx_community_likes_target" }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("community_likes");
    await queryInterface.dropTable("community_comments");
    await queryInterface.dropTable("community_posts");
  },
};
