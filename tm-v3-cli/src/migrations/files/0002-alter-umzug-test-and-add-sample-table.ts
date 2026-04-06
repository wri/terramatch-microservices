import { DataTypes, QueryInterface } from "sequelize";

type MigrationParams = {
  context: QueryInterface;
};

export async function up({ context }: MigrationParams) {
  await context.addColumn("umzug_test_table", "name", {
    type: DataTypes.STRING,
    allowNull: false
  });

  await context.addColumn("umzug_test_table", "created_at_extra", {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  });

  await context.addColumn("umzug_test_table", "deleted_at", {
    type: DataTypes.DATE,
    allowNull: true
  });

  await context.createTable("umzug_sample_table", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  await context.addIndex("umzug_sample_table", ["name"], {
    name: "umzug_sample_table_name_idx"
  });
}

export async function down({ context }: MigrationParams) {
  await context.removeIndex("umzug_sample_table", "umzug_sample_table_name_idx");
  await context.dropTable("umzug_sample_table");

  await context.removeColumn("umzug_test_table", "deleted_at");
  await context.removeColumn("umzug_test_table", "created_at_extra");
  await context.removeColumn("umzug_test_table", "name");
}
