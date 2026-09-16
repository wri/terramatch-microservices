import { BIGINT, BOOLEAN, DATE, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const createUserTasks: RunnableMigration<QueryInterface> = {
  name: "202609041522-create-user-tasks",

  async up({ context }) {
    await context.createTable("user_tasks", {
      id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      created_at: { type: DATE, allowNull: true },
      updated_at: { type: DATE, allowNull: true },
      deleted_at: { type: DATE, allowNull: true },
      user_id: { type: BIGINT.UNSIGNED, allowNull: false },
      task_id: { type: BIGINT.UNSIGNED, allowNull: false },
      assigned: { type: BOOLEAN, defaultValue: false },
      read: { type: BOOLEAN, defaultValue: false }
    });
  },

  async down({ context }) {
    await context.dropTable("user_tasks");
  }
};
