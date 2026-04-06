import { DataTypes, QueryInterface } from "sequelize";

type MigrationParams = {
  context: QueryInterface;
};

export async function up({ context }: MigrationParams) {
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
}

export async function down({ context }: MigrationParams) {
  await context.dropTable("umzug_test_table");
}
