import { RunnableMigration } from "umzug";
import { QueryInterface, BIGINT, DECIMAL, INTEGER, TEXT } from "sequelize";

const LOAN_STATUS_CLEANUP = `
UPDATE organisations
SET loan_status_amount = NULL
WHERE loan_status_amount IS NOT NULL
  AND (
    TRIM(loan_status_amount) = ''
    OR TRIM(loan_status_amount) NOT REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
  );
`;

export const unifyMonetaryDecimal152: RunnableMigration<QueryInterface> = {
  name: "202604081400-unify-monetary-decimal-15-2",

  async up({ context }) {
    await context.sequelize.query(LOAN_STATUS_CLEANUP);

    await context.changeColumn("organisations", "loan_status_amount", {
      type: DECIMAL(15, 2),
      allowNull: true
    });

    await context.changeColumn("project_pitches", "project_budget", {
      type: DECIMAL(15, 2),
      allowNull: true
    });

    await context.changeColumn("v2_projects", "budget", {
      type: DECIMAL(15, 2),
      allowNull: true
    });

    await context.changeColumn("v2_funding_types", "amount", {
      type: DECIMAL(15, 2),
      allowNull: false
    });
  },

  async down({ context }) {
    await context.changeColumn("v2_funding_types", "amount", {
      type: INTEGER.UNSIGNED,
      allowNull: false
    });

    await context.changeColumn("v2_projects", "budget", {
      type: INTEGER.UNSIGNED,
      allowNull: true
    });

    await context.changeColumn("project_pitches", "project_budget", {
      type: BIGINT.UNSIGNED,
      allowNull: true
    });

    await context.changeColumn("organisations", "loan_status_amount", {
      type: TEXT,
      allowNull: true
    });
  }
};
