import { BIGINT, DATE, INTEGER, QueryInterface, STRING } from "sequelize";
import { RunnableMigration } from "umzug";

export const createRsTreeCount: RunnableMigration<QueryInterface> = {
  name: "202609231200-create-rs-tree-count",

  async up({ context }) {
    await context.createTable("rs_tree_count", {
      id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      created_at: { type: DATE, defaultValue: null },
      updated_at: { type: DATE, defaultValue: null },
      deleted_at: { type: DATE, defaultValue: null },
      project_id: { type: BIGINT.UNSIGNED, allowNull: false, unique: true },
      verification_method: { type: STRING, allowNull: false },
      reported_count: { type: INTEGER, allowNull: false },
      tree_count_adj: { type: INTEGER, allowNull: false },
      upper_bounds: { type: INTEGER, allowNull: false },
      lower_bounds: { type: INTEGER, allowNull: false }
    });
  },

  async down({ context }) {
    await context.dropTable("rs_tree_count");
  }
};
