import { DataTypes, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const createTestTable: RunnableMigration<QueryInterface> = {
  name: "202604061450_create_test_table",

  async up({ context }) {
    await context.createTable("umzug_test_table", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });
  },

  async down({ context }) {
    await context.dropTable("umzug_test_table");
  }
};
