import { INTEGER, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const makeRsTreeCountAdjNullable: RunnableMigration<QueryInterface> = {
  name: "202609251200-make-rs-tree-count-adj-nullable",

  async up({ context }) {
    await context.changeColumn("rs_tree_count", "tree_count_adj", { type: INTEGER, allowNull: true });
  },

  async down({ context }) {
    await context.changeColumn("rs_tree_count", "tree_count_adj", { type: INTEGER, allowNull: false });
  }
};
