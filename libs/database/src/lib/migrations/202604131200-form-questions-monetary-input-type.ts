import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const formQuestionsMonetaryInputType: RunnableMigration<QueryInterface> = {
  name: "202604131200-form-questions-monetary-input-type",

  async up({ context }) {
    await context.sequelize.query(`
      UPDATE form_questions
      SET input_type = 'number-currency'
      WHERE linked_field_key IN ('pro-budget', 'pro-pit-bgt')
        AND input_type = 'number'
    `);
  },

  async down({ context }) {
    await context.sequelize.query(`
      UPDATE form_questions
      SET input_type = 'number'
      WHERE linked_field_key IN ('pro-budget', 'pro-pit-bgt')
        AND input_type = 'number-currency'
    `);
  }
};
