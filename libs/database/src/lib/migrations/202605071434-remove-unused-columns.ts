import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const removeUnusedColumns: RunnableMigration<QueryInterface> = {
  name: "202605071434-remove-unused-columns",

  async up({ context }) {
    await context.removeColumn("media", "type");
    await context.removeColumn("site_polygon", "last_modified_by");
    await context.removeColumn("v2_project_users", "deleted_at");
    await context.removeColumn("v2_site_reports", "seeds_planted");
    await context.removeColumn("v2_update_requests", "old_id");
    await context.removeColumn("v2_update_requests", "old_model");
  }
};
