import { RunnableMigration } from "umzug";
import { DATE, DATEONLY, QueryInterface } from "sequelize";

export const convertDeadlineAtToDate: RunnableMigration<QueryInterface> = {
  name: "202609181200-convert-deadline-at-to-date",

  async up({ context }) {
    await context.changeColumn("stages", "deadline_at", {
      type: DATEONLY,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.changeColumn("stages", "deadline_at", {
      type: DATE,
      allowNull: true
    });
  }
};
