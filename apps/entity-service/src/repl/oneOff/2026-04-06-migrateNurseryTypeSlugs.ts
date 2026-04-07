import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { FormQuestion, FormQuestionOption, Nursery, UpdateRequest } from "@terramatch-microservices/database/entities";
import { Dictionary } from "lodash";
import { Op } from "sequelize";

/** TM-3177 follow-up: align DB with new nursery type slugs (v2_nurseries.type + form_question_options). */
const OLD_TO_NEW: Readonly<Record<string, string>> = {
  building: "new-nursery",
  expanding: "nursery-expansion",
  managing: "co-managed-nursery"
};

const OLD_TYPE_VALUES = Object.keys(OLD_TO_NEW);

const NURSERY_TYPE_FORM_QUESTION_IDS = [1033, 2975, 3503, 4340] as const;

/**
 * Expected rows before migration (ids from TM ticket). If slug/label differ, the row is skipped with a warning.
 */
const FORM_QUESTION_OPTION_EXPECTED: ReadonlyArray<{
  id: number;
  expectSlug: string;
  expectLabel: string;
  slug: string;
  label: string;
}> = [
  { id: 2414, expectSlug: "building", expectLabel: "Building", slug: "new-nursery", label: "New Nursery" },
  {
    id: 2415,
    expectSlug: "expanding",
    expectLabel: "Expanding",
    slug: "nursery-expansion",
    label: "Nursery Expansion"
  },
  {
    id: 2416,
    expectSlug: "managing",
    expectLabel: "Managing",
    slug: "co-managed-nursery",
    label: "Co-Managed Nursery"
  },
  { id: 11595, expectSlug: "building", expectLabel: "Building", slug: "new-nursery", label: "New Nursery" },
  {
    id: 11596,
    expectSlug: "expanding",
    expectLabel: "Expanding",
    slug: "nursery-expansion",
    label: "Nursery Expansion"
  },
  {
    id: 11597,
    expectSlug: "managing",
    expectLabel: "Managing",
    slug: "co-managed-nursery",
    label: "Co-Managed Nursery"
  },
  { id: 14381, expectSlug: "building", expectLabel: "Building", slug: "new-nursery", label: "New Nursery" },
  {
    id: 14382,
    expectSlug: "expanding",
    expectLabel: "Expanding",
    slug: "nursery-expansion",
    label: "Nursery Expansion"
  },
  {
    id: 14383,
    expectSlug: "managing",
    expectLabel: "Managing",
    slug: "co-managed-nursery",
    label: "Co-Managed Nursery"
  },
  { id: 21181, expectSlug: "building", expectLabel: "Building", slug: "new-nursery", label: "New Nursery" },
  {
    id: 21182,
    expectSlug: "expanding",
    expectLabel: "Expanding",
    slug: "nursery-expansion",
    label: "Nursery Expansion"
  },
  {
    id: 21183,
    expectSlug: "managing",
    expectLabel: "Managing",
    slug: "co-managed-nursery",
    label: "Co-Managed Nursery"
  }
];

export type MigrateNurseryTypeSlugsOptions = {
  dryRun?: boolean;
};

export function remapNurseryTypeAnswerValues(
  content: Dictionary<unknown> | null,
  questionUuids: readonly string[]
): { next: Dictionary<unknown> | null; changed: boolean } {
  if (content == null) return { next: null, changed: false };
  let changed = false;
  const next: Dictionary<unknown> = { ...content };
  for (const qUuid of questionUuids) {
    const v = next[qUuid];
    if (typeof v === "string") {
      const mapped = OLD_TO_NEW[v];
      if (mapped != null) {
        next[qUuid] = mapped;
        changed = true;
      }
    }
  }
  return { next: changed ? next : content, changed };
}

export const migrateNurseryTypeSlugs = withoutSqlLogs(async (opts: MigrateNurseryTypeSlugsOptions = {}) => {
  const dryRun = opts.dryRun ?? true;

  const questions = await FormQuestion.findAll({
    where: { id: { [Op.in]: NURSERY_TYPE_FORM_QUESTION_IDS } },
    attributes: ["id", "uuid", "optionsList"]
  });

  if (questions.length !== NURSERY_TYPE_FORM_QUESTION_IDS.length) {
    console.warn(
      `migrateNurseryTypeSlugs: expected ${NURSERY_TYPE_FORM_QUESTION_IDS.length} form_questions, found ${questions.length}`
    );
  }

  const nurseryTypeQuestionUuids = questions.map(q => q.uuid);
  const wrongList = questions.filter(q => q.optionsList !== "nursery-type" && q.optionsList != null);
  if (wrongList.length > 0) {
    console.warn(
      "migrateNurseryTypeSlugs: form_questions without options_list nursery-type:",
      wrongList.map(q => ({ id: q.id, optionsList: q.optionsList }))
    );
  }

  const optionWarnings: string[] = [];
  let optionsUpdated = 0;

  for (const spec of FORM_QUESTION_OPTION_EXPECTED) {
    const row = await FormQuestionOption.findByPk(spec.id, { attributes: ["id", "slug", "label"] });
    if (row == null) {
      optionWarnings.push(`form_question_options id=${spec.id} not found`);
      continue;
    }
    if (row.slug !== spec.expectSlug || row.label !== spec.expectLabel) {
      optionWarnings.push(
        `form_question_options id=${spec.id}: expected slug=${spec.expectSlug} label=${spec.expectLabel}, got slug=${row.slug} label=${row.label}`
      );
      continue;
    }
    if (!dryRun) {
      await row.update({ slug: spec.slug, label: spec.label });
    }
    optionsUpdated += 1;
  }

  let nurseriesTypeUpdated = 0;
  for (const oldVal of OLD_TYPE_VALUES) {
    const newVal = OLD_TO_NEW[oldVal];
    if (dryRun) {
      nurseriesTypeUpdated += await Nursery.count({ where: { type: oldVal } });
    } else {
      const [count] = await Nursery.update({ type: newVal }, { where: { type: oldVal }, silent: true });
      nurseriesTypeUpdated += count;
    }
  }

  let nurseryAnswersUpdated = 0;
  const nurseryAnswersBuilder = new PaginatedQueryBuilder(Nursery, 100)
    .attributes(["id", "answers"])
    .where({ answers: { [Op.ne]: null } });

  for await (const page of batchFindAll(nurseryAnswersBuilder)) {
    for (const nursery of page) {
      const answers = nursery.answers as Dictionary<unknown> | null;
      const { next, changed } = remapNurseryTypeAnswerValues(answers, nurseryTypeQuestionUuids);
      if (!changed) continue;
      nurseryAnswersUpdated += 1;
      if (!dryRun) {
        await nursery.update({ answers: next }, { silent: true });
      }
    }
  }

  let updateRequestsUpdated = 0;
  const urBuilder = new PaginatedQueryBuilder(UpdateRequest, 100).attributes(["id", "content"]).where({
    updateRequestableType: Nursery.LARAVEL_TYPE,
    content: { [Op.ne]: null }
  });

  for await (const page of batchFindAll(urBuilder)) {
    for (const ur of page) {
      const content = ur.content as Dictionary<unknown> | null;
      const { next, changed } = remapNurseryTypeAnswerValues(content, nurseryTypeQuestionUuids);
      if (!changed) continue;
      updateRequestsUpdated += 1;
      if (!dryRun) {
        await ur.update({ content: next }, { silent: true });
      }
    }
  }

  console.log(`\nmigrateNurseryTypeSlugs ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`form_question_options rows updated: ${optionsUpdated} (of ${FORM_QUESTION_OPTION_EXPECTED.length})`);
  console.log(`v2_nurseries.type rows updated: ${nurseriesTypeUpdated}`);
  console.log(`v2_nurseries rows with answers JSON updated: ${nurseryAnswersUpdated}`);
  console.log(`v2_update_requests rows (nursery) with content JSON updated: ${updateRequestsUpdated}`);
  if (optionWarnings.length > 0) {
    console.log("\nWarnings:");
    console.log(optionWarnings.join("\n"));
  }
});
