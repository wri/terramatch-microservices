import { RunnableMigration } from "umzug";
import { BOOLEAN, QueryInterface } from "sequelize";

const TABLES = ["v2_projects", "v2_sites", "v2_nurseries"] as const;

export const addIsArchivedToProjectsSitesNurseries: RunnableMigration<QueryInterface> = {
  name: "202608241200-add-is-archived-to-projects-sites-nurseries",

  async up({ context }) {
    for (const table of TABLES) {
      await context.addColumn(table, "is_archived", {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  async down({ context }) {
    for (const table of TABLES) {
      await context.removeColumn(table, "is_archived");
    }
  }
};
