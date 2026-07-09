import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const removeDbTriggers: RunnableMigration<QueryInterface> = {
  name: "202607071906-remove-db-triggers",

  async up({ context }) {
    await context.sequelize.query("DROP TRIGGER IF EXISTS before_insert_v2_projects");
    await context.sequelize.query("DROP TRIGGER IF EXISTS before_insert_v2_sites");
    await context.sequelize.query("DROP TRIGGER IF EXISTS before_update_v2_projects");
    await context.sequelize.query("DROP TRIGGER IF EXISTS before_update_v2_sites");
  }
};
