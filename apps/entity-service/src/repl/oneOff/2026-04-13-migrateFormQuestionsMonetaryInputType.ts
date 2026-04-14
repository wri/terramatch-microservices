import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FormQuestion } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

const LINKED_KEYS = ["pro-budget", "pro-pit-bgt"] as const;

/**
 * Data fix: set monetary budget questions to number-currency so the API exposes the correct inputType
 * (DB rows may still say number until this runs in each environment).
 */
export const migrateFormQuestionsMonetaryInputType = withoutSqlLogs(async () => {
  const [affected] = await FormQuestion.update(
    { inputType: "number-currency" },
    {
      where: {
        linkedFieldKey: { [Op.in]: LINKED_KEYS },
        inputType: "number"
      }
    }
  );

  console.log(
    `migrateFormQuestionsMonetaryInputType: updated ${affected} form_questions row(s) to input_type=number-currency.`
  );

  return { affected };
});
