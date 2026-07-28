import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

const PROJECT_QA_STATUS_COLUMNS = [
  "project_qa_status1",
  "project_qa_status2",
  "project_qa_status3",
  "project_qa_status4",
  "project_qa_status5"
] as const;

export const updateProjectQaStatusNullable: RunnableMigration<QueryInterface> = {
  name: "202607281200-update-project-qa-status-nullable",

  async up({ context }) {
    for (const column of PROJECT_QA_STATUS_COLUMNS) {
      await context.sequelize.query(
        `UPDATE v2_projects SET \`${column}\` = NULL WHERE \`${column}\` IN ('due', 'not-applicable')`
      );
      await context.changeColumn("v2_projects", column, {
        type: STRING(64),
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down({ context }) {
    for (const column of [...PROJECT_QA_STATUS_COLUMNS].reverse()) {
      await context.sequelize.query(
        `UPDATE v2_projects SET \`${column}\` = 'due' WHERE \`${column}\` IS NULL OR \`${column}\` = 'no-data-expected'`
      );
      await context.changeColumn("v2_projects", column, {
        type: STRING(64),
        allowNull: false,
        defaultValue: "due"
      });
    }
  }
};
