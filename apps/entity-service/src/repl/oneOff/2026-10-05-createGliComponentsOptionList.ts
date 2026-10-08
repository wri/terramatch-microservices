import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption
} from "@terramatch-microservices/database/entities";
import { isNotNull } from "@terramatch-microservices/database/types/array";

const LIST_KEY = "gli-components";

const GLI_COMPONENTS = [
  { slug: "restoration-of-degraded-landscapes", label: "Restoration of Degraded Landscapes" },
  {
    slug: "conservation-and-sustainable-management-of-natural-forest",
    label: "Conservation and Sustainable Management of Natural Forest"
  },
  {
    slug: "management-of-plantation-forests-value-addition-and-import-substitution",
    label: "Management of Plantation Forests, Value Addition, and Import Substitution"
  },
  {
    slug: "innovation-technology-generation-adoption-and-dissemination",
    label: "Innovation, Technology Generation, Adoption and Dissemination"
  },
  {
    slug: "capacity-development-and-institutional-strengthening",
    label: "Capacity Development and Institutional Strengthening"
  },
  { slug: "knowledge-management-and-monitoring-system", label: "Knowledge Management and Monitoring System" }
] as const;

/**
 * Creates the option list backing the GLI Components linked fields on project pitches and projects,
 * and fills in the options of any GLI Components form question that was saved without options
 * (the form builder copies list options onto a question client-side, which can be skipped).
 *
 * Run in entity-service REPL:
 *   await oneOff.createGliComponentsOptionList()
 *   await oneOff.createGliComponentsOptionList({ dryRun: false })
 *
 * Safe to re-run: only missing options are created, and only questions without options are filled in.
 */
export const createGliComponentsOptionList = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const list = await FormOptionList.findOne({ where: { key: LIST_KEY }, attributes: ["id"] });
  const existingSlugs =
    list == null
      ? new Set<string | null>()
      : new Set(
          (await FormOptionListOption.findAll({ where: { formOptionListId: list.id }, attributes: ["slug"] })).map(
            ({ slug }) => slug
          )
        );
  const missing = GLI_COMPONENTS.filter(({ slug }) => !existingSlugs.has(slug));

  const questions = await FormQuestion.findAll({ where: { optionsList: LIST_KEY }, attributes: ["id", "uuid"] });
  const questionIdsWithOptions = new Set(
    (
      await FormQuestionOption.findAll({
        where: { formQuestionId: questions.map(({ id }) => id) },
        attributes: ["formQuestionId"]
      })
    ).map(({ formQuestionId }) => formQuestionId)
  );
  const emptyQuestions = questions.filter(({ id }) => !questionIdsWithOptions.has(id));

  if (!dryRun) {
    // These entities use the legacy Model<T> typing, which requires every attribute on create.
    const listId = list?.id ?? (await FormOptionList.create({ key: LIST_KEY } as FormOptionList)).id;
    if (missing.length > 0) {
      await FormOptionListOption.bulkCreate(
        missing.map(({ slug, label }) => ({ formOptionListId: listId, slug, label }) as FormOptionListOption)
      );
    }

    if (emptyQuestions.length > 0) {
      const listOptions = await FormOptionListOption.findAll({
        where: { formOptionListId: listId },
        attributes: ["id", "slug", "label"]
      });
      const listOptionsBySlug = new Map(listOptions.map(option => [option.slug, option]));
      const orderedListOptions = GLI_COMPONENTS.map(({ slug }) => listOptionsBySlug.get(slug)).filter(isNotNull);
      await FormQuestionOption.bulkCreate(
        emptyQuestions.flatMap(({ id: formQuestionId }) =>
          orderedListOptions.map(
            ({ id, slug, label }, order) =>
              ({ formQuestionId, slug, label, order, formOptionListOptionId: id }) as FormQuestionOption
          )
        )
      );
    }
  }

  return {
    dryRun,
    listCreated: list == null,
    optionsCreated: missing.map(({ slug }) => slug),
    questionsFilled: emptyQuestions.map(({ uuid }) => uuid)
  };
});
