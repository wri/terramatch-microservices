import { DataTypes, QueryInterface } from "sequelize";

type MigrationParams = {
  context: QueryInterface;
};

export async function up({ context }: MigrationParams) {
  await context.createTable("sample_table", {
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
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  await context.addIndex("sample_table", ["name"], {
    name: "sample_table_name_idx"
  });
}

export async function down({ context }: MigrationParams) {
  await context.removeIndex("sample_table", "sample_table_name_idx");
  await context.dropTable("sample_table");
}
