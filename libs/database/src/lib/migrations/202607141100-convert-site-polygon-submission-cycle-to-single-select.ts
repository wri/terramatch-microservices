import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, STRING } from "sequelize";

const SUBMISSION_CYCLE_TO_SINGLE_SELECT = `
UPDATE site_polygon
SET submission_cycle = CASE
  WHEN JSON_TYPE(submission_cycle) = 'ARRAY' AND JSON_LENGTH(submission_cycle) > 0
    THEN JSON_EXTRACT(submission_cycle, CONCAT('$[', JSON_LENGTH(submission_cycle) - 1, ']'))
  WHEN JSON_TYPE(submission_cycle) = 'ARRAY' THEN NULL
  WHEN JSON_TYPE(submission_cycle) = 'STRING' THEN submission_cycle
  ELSE NULL
END
WHERE submission_cycle IS NOT NULL
  AND JSON_TYPE(submission_cycle) IN ('ARRAY', 'STRING');
`;

const SUBMISSION_CYCLE_STRIP_JSON_QUOTES = `
UPDATE site_polygon
SET submission_cycle = TRIM(BOTH '"' FROM submission_cycle)
WHERE submission_cycle IS NOT NULL;
`;

const SUBMISSION_CYCLE_TO_JSON_ARRAY = `
UPDATE site_polygon
SET submission_cycle = JSON_ARRAY(submission_cycle)
WHERE submission_cycle IS NOT NULL;
`;

export const convertSitePolygonSubmissionCycleToSingleSelect: RunnableMigration<QueryInterface> = {
  name: "202607141100-convert-site-polygon-submission-cycle-to-single-select",

  async up({ context }) {
    // Multiple cycles were only ever an artifact of the JSON array column; keep the most
    // recent selection (last array entry) as the single value, matching the cohort migration.
    await context.sequelize.query(SUBMISSION_CYCLE_TO_SINGLE_SELECT);

    await context.changeColumn("site_polygon", "submission_cycle", {
      type: STRING,
      allowNull: true
    });

    await context.sequelize.query(SUBMISSION_CYCLE_STRIP_JSON_QUOTES);
  },

  async down({ context }) {
    await context.changeColumn("site_polygon", "submission_cycle", {
      type: JSON_TYPE,
      allowNull: true
    });

    await context.sequelize.query(SUBMISSION_CYCLE_TO_JSON_ARRAY);
  }
};
