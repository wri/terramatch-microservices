import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

const BROKEN_READ_MORE_URL = "https://www.india.terramatch.org/";
const CORRECT_READ_MORE_URL = "https://www.haritbharatfund.in/";

export const updateHaritBharatFundReadMoreUrl: RunnableMigration<QueryInterface> = {
  name: "202607271530-update-harit-bharat-fund-read-more-url",

  async up({ context }) {
    await context.sequelize.query(
      `
      UPDATE funding_programmes
      SET read_more_url = :correctUrl
      WHERE read_more_url LIKE '%india.terramatch.org%';
      `,
      {
        replacements: { correctUrl: CORRECT_READ_MORE_URL }
      }
    );
  },

  async down({ context }) {
    await context.sequelize.query(
      `
      UPDATE funding_programmes
      SET read_more_url = :brokenUrl
      WHERE read_more_url = :correctUrl;
      `,
      {
        replacements: {
          brokenUrl: BROKEN_READ_MORE_URL,
          correctUrl: CORRECT_READ_MORE_URL
        }
      }
    );
  }
};
