import { BIGINT, QueryInterface, STRING, TEXT, UUID } from "sequelize";
import { RunnableMigration } from "umzug";

export const createStakeholders: RunnableMigration<QueryInterface> = {
  name: "202610041200-create-stakeholders",

  async up({ context }) {
    await context.createTable("stakeholders", {
      id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      uuid: { type: UUID, allowNull: false },
      stakeholderable_type: { type: STRING, allowNull: false },
      stakeholderable_id: { type: BIGINT.UNSIGNED, allowNull: false },
      name: { type: STRING, allowNull: true },
      key_role: { type: STRING, allowNull: true },
      description: { type: TEXT, allowNull: true },
      deleted_at: { type: "TIMESTAMP NULL", defaultValue: null },
      created_at: { type: "TIMESTAMP NULL", defaultValue: null },
      updated_at: { type: "TIMESTAMP NULL", defaultValue: null }
    });
    await context.addIndex("stakeholders", ["uuid"], { name: "stakeholders_uuid_index" });
    await context.addIndex("stakeholders", ["stakeholderable_type", "stakeholderable_id"], {
      name: "stakeholders_stakeholderable_index"
    });
  },

  async down({ context }) {
    await context.dropTable("stakeholders");
  }
};
