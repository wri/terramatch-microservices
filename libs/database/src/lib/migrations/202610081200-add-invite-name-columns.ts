import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

const TABLES = ["v2_organisation_invites", "v2_project_invites"];
const COLUMNS = ["first_name", "last_name"];

export const addInviteNameColumns: RunnableMigration<QueryInterface> = {
  name: "202610081200-add-invite-name-columns",

  async up({ context }) {
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        await context.addColumn(table, column, { type: STRING, allowNull: true });
      }
    }
  },

  async down({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        await context.sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN IF EXISTS \`${column}\``);
      }
    }
  }
};
