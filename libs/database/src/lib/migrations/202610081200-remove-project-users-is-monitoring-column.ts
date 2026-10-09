import { RunnableMigration } from "umzug";
import { BOOLEAN, QueryInterface } from "sequelize";

export const removeProjectUsersIsMonitoringColumn: RunnableMigration<QueryInterface> = {
  name: "202610081200-remove-project-users-is-monitoring-column",

  async up({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `v2_project_users` DROP COLUMN IF EXISTS `is_monitoring`");
  },

  async down({ context }) {
    await context.addColumn("v2_project_users", "is_monitoring", {
      type: BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  }
};
