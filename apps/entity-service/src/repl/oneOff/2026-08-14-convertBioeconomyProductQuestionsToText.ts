import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption,
  Media
} from "@terramatch-microservices/database/entities";
import { Op, Transaction } from "sequelize";

const LINKED_FIELD_KEYS = ["pro-rep-bioeconomy-product-benefit", "pro-rep-bioeconomy-product-sold"] as const;

type Options = {
  dryRun?: boolean;
};

type Summary = {
  dryRun: boolean;
  questionsFound: number;
  questionIds: number[];
  optionListKeys: string[];
  unusedOptionListKeys: string[];
  questionOptionsFound: number;
  unusedListOptionsFound: number;
  questionsUpdated: number;
  questionOptionsDeleted: number;
  mediaDeleted: number;
  listOptionsDeleted: number;
  optionListsDeleted: number;
};

/**
 * Converts bioeconomy product benefit/sold form questions from select to text
 * and removes their select option associations.
 *
 * Shared option lists still referenced by other questions (e.g. bioeconomy-product-list
 * on product-list fields) are left in place.
 *
 * Run: > await oneOff.convertBioeconomyProductQuestionsToText()
 * Dry: > await oneOff.convertBioeconomyProductQuestionsToText({ dryRun: true })
 */
export const convertBioeconomyProductQuestionsToText = withoutSqlLogs(async (opts: Options = {}) => {
  const { dryRun = false } = opts;
  const sequelize = FormQuestion.sequelize;
  if (sequelize == null) throw new Error("Sequelize instance not available");

  const questions = await FormQuestion.findAll({
    where: { linkedFieldKey: { [Op.in]: [...LINKED_FIELD_KEYS] } },
    attributes: ["id", "uuid", "linkedFieldKey", "inputType", "multiChoice", "optionsList"]
  });

  if (questions.length === 0) {
    const empty: Summary = {
      dryRun,
      questionsFound: 0,
      questionIds: [],
      optionListKeys: [],
      unusedOptionListKeys: [],
      questionOptionsFound: 0,
      unusedListOptionsFound: 0,
      questionsUpdated: 0,
      questionOptionsDeleted: 0,
      mediaDeleted: 0,
      listOptionsDeleted: 0,
      optionListsDeleted: 0
    };
    console.log("convertBioeconomyProductQuestionsToText:", JSON.stringify(empty, null, 2));
    return empty;
  }

  const questionIds = questions.map(({ id }) => id);
  const optionListKeys = [
    ...new Set(
      questions
        .map(({ optionsList }) => optionsList)
        .filter((key): key is string => key != null && key !== "" && key !== "0")
    )
  ];

  const questionOptions = await FormQuestionOption.findAll({
    where: { formQuestionId: questionIds },
    attributes: ["id"]
  });
  const questionOptionIds = questionOptions.map(({ id }) => id);

  const unusedOptionLists = await findUnusedOptionLists(optionListKeys, questionIds);
  const unusedOptionListIds = unusedOptionLists.map(({ id }) => id);
  const unusedListOptionsFound =
    unusedOptionListIds.length === 0
      ? 0
      : await FormOptionListOption.count({ where: { formOptionListId: unusedOptionListIds } });

  const counts = dryRun
    ? {
        questionsUpdated: 0,
        questionOptionsDeleted: 0,
        mediaDeleted: 0,
        listOptionsDeleted: 0,
        optionListsDeleted: 0
      }
    : await sequelize.transaction(transaction =>
        applyChanges({ questionIds, questionOptionIds, unusedOptionListIds }, transaction)
      );

  const summary: Summary = {
    dryRun,
    questionsFound: questions.length,
    questionIds,
    optionListKeys,
    unusedOptionListKeys: unusedOptionLists.map(({ key }) => key),
    questionOptionsFound: questionOptionIds.length,
    unusedListOptionsFound,
    ...counts
  };

  console.log("convertBioeconomyProductQuestionsToText:", JSON.stringify(summary, null, 2));
  return summary;
});

const findUnusedOptionLists = async (optionListKeys: string[], questionIds: number[]) => {
  if (optionListKeys.length === 0) return [];

  const lists = await FormOptionList.findAll({
    where: { key: { [Op.in]: optionListKeys } },
    attributes: ["id", "key"]
  });
  if (lists.length === 0) return [];

  const stillUsed = await FormQuestion.findAll({
    where: {
      id: { [Op.notIn]: questionIds },
      optionsList: { [Op.in]: optionListKeys }
    },
    attributes: ["optionsList"]
  });
  const stillUsedKeys = new Set(
    stillUsed.map(({ optionsList }) => optionsList).filter((key): key is string => key != null)
  );

  return lists.filter(({ key }) => !stillUsedKeys.has(key));
};

const applyChanges = async (
  ids: { questionIds: number[]; questionOptionIds: number[]; unusedOptionListIds: number[] },
  transaction: Transaction
) => {
  const { questionIds, questionOptionIds, unusedOptionListIds } = ids;
  let mediaDeleted = 0;
  let questionOptionsDeleted = 0;
  let listOptionsDeleted = 0;
  let optionListsDeleted = 0;

  if (questionOptionIds.length > 0) {
    mediaDeleted = await Media.destroy({
      where: { modelType: FormQuestionOption.LARAVEL_TYPE, modelId: questionOptionIds },
      transaction
    });
    questionOptionsDeleted = await FormQuestionOption.destroy({
      where: { formQuestionId: questionIds },
      transaction
    });
  }

  if (unusedOptionListIds.length > 0) {
    listOptionsDeleted = await FormOptionListOption.destroy({
      where: { formOptionListId: unusedOptionListIds },
      transaction
    });
    optionListsDeleted = await FormOptionList.destroy({
      where: { id: unusedOptionListIds },
      transaction
    });
  }

  const [questionsUpdated] = await FormQuestion.update(
    { inputType: "text", multiChoice: false, optionsList: null },
    { where: { id: questionIds }, transaction }
  );

  return {
    questionsUpdated,
    questionOptionsDeleted,
    mediaDeleted,
    listOptionsDeleted,
    optionListsDeleted
  };
};
