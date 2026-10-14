import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const dropRolePermissionTables: RunnableMigration<QueryInterface> = {
  name: "202610141200-drop-role-permission-tables",

  async up({ context }) {
    // The join tables reference roles / permissions, so they have to go first.
    await context.dropTable("model_has_roles");
    await context.dropTable("role_has_permissions");
    await context.dropTable("permissions");
    await context.dropTable("roles");
  }
};
