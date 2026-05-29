import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, STRING } from "sequelize";

const COHORT_TO_SINGLE_SELECT = `
UPDATE v2_projects
SET cohort = CASE
  WHEN JSON_TYPE(cohort) = 'ARRAY' THEN JSON_UNQUOTE(JSON_EXTRACT(cohort, CONCAT('$[', JSON_LENGTH(cohort) - 1, ']')))
  WHEN JSON_TYPE(cohort) = 'STRING' THEN JSON_UNQUOTE(cohort)
  ELSE NULL
END
WHERE cohort IS NOT NULL
  AND JSON_TYPE(cohort) IN ('ARRAY', 'STRING');
`;

const COHORT_TO_JSON_ARRAY = `
UPDATE v2_projects
SET cohort = JSON_ARRAY(JSON_UNQUOTE(cohort))
WHERE cohort IS NOT NULL;
`;

export const convertProjectCohortToSingleSelect: RunnableMigration<QueryInterface> = {
  name: "202605291200-convert-project-cohort-to-single-select",

  async up({ context }) {
    await context.sequelize.query(COHORT_TO_SINGLE_SELECT);

    await context.changeColumn("v2_projects", "cohort", {
      type: STRING(255),
      allowNull: true
    });
  },

  async down({ context }) {
    await context.changeColumn("v2_projects", "cohort", {
      type: JSON_TYPE,
      allowNull: true
    });

    await context.sequelize.query(COHORT_TO_JSON_ARRAY);
  }
};
