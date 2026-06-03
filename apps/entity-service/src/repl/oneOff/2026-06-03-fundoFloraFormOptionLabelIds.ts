import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  FormOptionList,
  FormQuestion,
  FormQuestionOption,
  I18nItem
} from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";

/**
 * One-off (REPL): ensure i18n label_id exists on Fundo Flora establishment option rows so
 * GET /forms with translated=true can resolve labels after Transifex pull.
 *
 * Run: > await oneOff.fundoFloraFormOptionLabelIds()
 * Then in admin: Push translations → translate in TFX → Pull translations (per form).
 */

const OPTION_LIST_KEYS = ["land-tenures", "siting-strategies", "landowner-collection"] as const;

const QUESTION_LINKED_FIELD_KEYS = [
  "pro-land-tenure-proj-area",
  "pro-landowner-agreement",
  "pro-siting-strategy",
  "site-land-tenures",
  "site-col-siting-strategy"
] as const;

const generateMissingLabelI18nItem = async (label: string | null, labelId: number | null) => {
  const value = label?.trim() ?? "";
  if (value === "" || labelId != null) return labelId;

  const isShort = value.length <= 256;
  const i18nItem = await I18nItem.create({
    type: isShort ? "short" : "long",
    status: "draft",
    shortValue: isShort ? value : null,
    longValue: isShort ? null : value
  } as CreationAttributes<I18nItem>);
  return i18nItem.id;
};

const backfillLabelIds = async <T extends { label: string | null; labelId: number | null; save: () => Promise<T> }>(
  rows: T[]
) => {
  let updated = 0;
  for (const row of rows) {
    const nextLabelId = await generateMissingLabelI18nItem(row.label, row.labelId);
    if (nextLabelId != null && nextLabelId !== row.labelId) {
      row.labelId = nextLabelId;
      await row.save();
      updated += 1;
    }
  }
  return updated;
};

export const fundoFloraFormOptionLabelIds = withoutSqlLogs(async () => {
  const optionLists = await FormOptionList.findAll({
    where: { key: [...OPTION_LIST_KEYS] },
    include: [{ association: "listOptions" }]
  });

  let listOptionsProcessed = 0;
  let listOptionsUpdated = 0;
  for (const list of optionLists) {
    const options = list.listOptions ?? [];
    listOptionsProcessed += options.length;
    listOptionsUpdated += await backfillLabelIds(options);
  }

  const questions = await FormQuestion.findAll({
    where: { linkedFieldKey: [...QUESTION_LINKED_FIELD_KEYS] }
  });
  const questionOptions =
    questions.length === 0
      ? []
      : await FormQuestionOption.findAll({
          where: { formQuestionId: questions.map(({ id }) => id) }
        });

  const questionOptionsUpdated = await backfillLabelIds(questionOptions);

  const summary = {
    optionLists: optionLists.map(({ key }) => key),
    listOptionsProcessed,
    listOptionsUpdated,
    questionsProcessed: questions.length,
    questionOptionsProcessed: questionOptions.length,
    questionOptionsUpdated
  };
  console.log("fundoFloraFormOptionLabelIds:", JSON.stringify(summary));
  return summary;
});
