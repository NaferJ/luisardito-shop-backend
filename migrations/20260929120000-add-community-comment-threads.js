"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("community_comments", "parent_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "community_comments", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      comment: "Parent comment for threaded replies (null = top-level)",
    });
    await queryInterface.addColumn("community_comments", "pinned", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Pinned inside the post (top-level comments only)",
    });
    await queryInterface.addColumn("community_comments", "edited_at", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Last author edit timestamp (null = never edited)",
    });
    await queryInterface.addIndex(
      "community_comments",
      ["post_id", "parent_id"],
      { name: "idx_community_comments_thread" }
    );

    await queryInterface.addColumn("community_posts", "edited_at", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Last author edit timestamp (null = never edited)",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "community_comments",
      "idx_community_comments_thread"
    );
    await queryInterface.removeColumn("community_comments", "parent_id");
    await queryInterface.removeColumn("community_comments", "pinned");
    await queryInterface.removeColumn("community_comments", "edited_at");
    await queryInterface.removeColumn("community_posts", "edited_at");
  },
};
