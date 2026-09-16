import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

const PROJECT_QA_STATUS_COLUMNS = [
  "project_qa_status1",
  "project_qa_status2",
  "project_qa_status3",
  "project_qa_status4",
  "project_qa_status5"
] as const;

const PROJECT_QA_STATUS_INITIAL_DEFAULT = "due";

export const addProjectQaStatusColumns: RunnableMigration<QueryInterface> = {
  name: "202607131530-add-project-qa-status-columns",

  async up({ context }) {
    for (const column of PROJECT_QA_STATUS_COLUMNS) {
      await context.addColumn("v2_projects", column, {
        type: STRING(64),
        allowNull: false,
        defaultValue: PROJECT_QA_STATUS_INITIAL_DEFAULT
      });
    }
  },

  async down({ context }) {
    for (const column of [...PROJECT_QA_STATUS_COLUMNS].reverse()) {
      await context.removeColumn("v2_projects", column);
    }
  }
};
