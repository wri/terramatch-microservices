import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, STRING } from "sequelize";

const COHORT_TO_SINGLE_SELECT = `
UPDATE v2_projects
SET cohort = CASE
  WHEN JSON_TYPE(cohort) = 'ARRAY' AND JSON_LENGTH(cohort) > 0
    THEN JSON_EXTRACT(cohort, CONCAT('$[', JSON_LENGTH(cohort) - 1, ']'))
  WHEN JSON_TYPE(cohort) = 'ARRAY' THEN NULL
  WHEN JSON_TYPE(cohort) = 'STRING' THEN cohort
  ELSE NULL
END
WHERE cohort IS NOT NULL
  AND JSON_TYPE(cohort) IN ('ARRAY', 'STRING');
`;

const COHORT_STRIP_JSON_QUOTES = `
UPDATE v2_projects
SET cohort = TRIM(BOTH '"' FROM cohort)
WHERE cohort IS NOT NULL;
`;

const COHORT_TO_JSON_ARRAY = `
UPDATE v2_projects
SET cohort = JSON_ARRAY(cohort)
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

    await context.sequelize.query(COHORT_STRIP_JSON_QUOTES);
  },

  async down({ context }) {
    await context.changeColumn("v2_projects", "cohort", {
      type: JSON_TYPE,
      allowNull: true
    });

    await context.sequelize.query(COHORT_TO_JSON_ARRAY);
  }
};
