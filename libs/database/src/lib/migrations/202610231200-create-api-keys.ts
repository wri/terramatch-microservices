import { BIGINT, literal, QueryInterface, STRING } from "sequelize";
import { RunnableMigration } from "umzug";

export const createApiKeys: RunnableMigration<QueryInterface> = {
  name: "202610231200-create-api-keys",

  async up({ context }) {
    await context.createTable("api_keys", {
      id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      created_at: { type: "TIMESTAMP", allowNull: false, defaultValue: literal("CURRENT_TIMESTAMP") },
      updated_at: { type: "TIMESTAMP", allowNull: false, defaultValue: literal("CURRENT_TIMESTAMP") },
      user_id: { type: BIGINT.UNSIGNED, allowNull: false },
      key: { type: STRING, allowNull: false },
      expires_at: { type: "TIMESTAMP NULL", defaultValue: null }
    });
    await context.addIndex("api_keys", ["key"], { name: "api_keys_key_unique", unique: true });
    await context.addIndex("api_keys", ["user_id"], { name: "api_keys_user_id_index" });
  },

  async down({ context }) {
    await context.dropTable("api_keys");
  }
};
