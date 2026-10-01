import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

const FUNDO_FLORA_COHORT_2 = "fundo-flora-cohort-2";

const PROJECT_UUIDS = [
  "2fe527c9-ce59-43bb-80a7-b754f8441141",
  "9a18c5bb-d561-4772-a7c8-6cfd9d4c06de",
  "34c848a7-7100-4286-85d4-f7c948dfa550",
  "66a1b5c6-5017-4189-9b4c-7ec79eae3f62",
  "e40a101e-b72b-4330-b783-2de039022c1b"
];

export const assignFundoFloraCohort2: RunnableMigration<QueryInterface> = {
  name: "202609171430-assign-fundo-flora-cohort-2",

  async up({ context }) {
    await context.sequelize.query(
      `
      UPDATE v2_projects
      SET cohort = :cohort
      WHERE uuid IN (:uuids)
      `,
      {
        replacements: { cohort: FUNDO_FLORA_COHORT_2, uuids: PROJECT_UUIDS }
      }
    );
  },

  async down({ context }) {
    await context.sequelize.query(
      `
      UPDATE v2_projects
      SET cohort = NULL
      WHERE uuid IN (:uuids)
        AND cohort = :cohort
      `,
      {
        replacements: { cohort: FUNDO_FLORA_COHORT_2, uuids: PROJECT_UUIDS }
      }
    );
  }
};
