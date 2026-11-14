import { INTEGER, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

const COLUMNS = ["reported_count", "upper_bounds", "lower_bounds"];

export const makeRsTreeCountCountsNullable: RunnableMigration<QueryInterface> = {
  name: "202611131200-make-rs-tree-count-counts-nullable",

  async up({ context }) {
    for (const column of COLUMNS) {
      await context.changeColumn("rs_tree_count", column, { type: INTEGER, allowNull: true });
    }
  },

  async down({ context }) {
    for (const column of COLUMNS) {
      await context.changeColumn("rs_tree_count", column, { type: INTEGER, allowNull: false });
    }
  }
};
