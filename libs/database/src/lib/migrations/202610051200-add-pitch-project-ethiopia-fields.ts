import { RunnableMigration } from "umzug";
import { DataType, INTEGER, QueryInterface, TEXT } from "sequelize";

const COLUMNS: { table: string; column: string; type: DataType }[] = [
  { table: "project_pitches", column: "indirect_entities", type: TEXT },
  { table: "project_pitches", column: "land_access_description", type: TEXT },
  { table: "project_pitches", column: "cofinancing_amount", type: INTEGER.UNSIGNED },
  { table: "project_pitches", column: "cofinancing_details", type: TEXT },
  { table: "project_pitches", column: "gli_components", type: TEXT },
  { table: "v2_projects", column: "indirect_entities", type: TEXT },
  { table: "v2_projects", column: "gli_components", type: TEXT }
];

export const addPitchProjectEthiopiaFields: RunnableMigration<QueryInterface> = {
  name: "202610051200-add-pitch-project-ethiopia-fields",

  async up({ context }) {
    for (const { table, column, type } of COLUMNS) {
      await context.addColumn(table, column, { type, allowNull: true });
    }
  },

  async down({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    for (const { table, column } of COLUMNS) {
      await context.sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN IF EXISTS \`${column}\``);
    }
  }
};
