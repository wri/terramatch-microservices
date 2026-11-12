import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  AboutSection,
  DisturbanceReport,
  FinancialReport,
  Form,
  FormQuestion,
  Framework,
  FrameworkUser,
  FundingProgramme,
  Nursery,
  NurseryReport,
  PolygonAttributeDefinition,
  Project,
  ProjectReport,
  ScheduledJob,
  Site,
  SiteReport,
  SrpReport,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { FRAMEWORK_NAMES, FrameworkKey, TERRAFUND_NON_PROFITS } from "@terramatch-microservices/database/constants";
import { TASK_DUE } from "@terramatch-microservices/database/constants/scheduled-jobs";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Dictionary, difference, uniq } from "lodash";
import { Op, Transaction, WhereOptions } from "sequelize";

const TERRAFUND = "terrafund";
const LANDSCAPES = "terrafund-landscapes";
const TERRAFUND_3 = "terrafund-3";
const OLD_KEYS: string[] = [TERRAFUND, LANDSCAPES, TERRAFUND_3];

// The old keys are no longer valid FrameworkKey values, so filters on them need a looser type.
const OLD_KEYS_WHERE = { frameworkKey: { [Op.in]: OLD_KEYS } } as WhereOptions;

// Report reminder jobs are no longer processed by the job service, so pending ones are removed.
const REPORT_REMINDER = "App\\Models\\V2\\ScheduledJobs\\ReportReminderJOb";

// terrafund-3's forms are moved to the new framework (instead of copied) so that the question UUIDs
// that key existing terrafund-3 answers stay valid.
const TF3_FORM_COLUMNS = [
  "projectFormUuid",
  "projectReportFormUuid",
  "siteFormUuid",
  "siteReportFormUuid",
  "nurseryFormUuid",
  "nurseryReportFormUuid",
  "disturbanceReportFormUuid"
] as const;

const REKEYED_MODELS = [
  Project,
  Site,
  Nursery,
  ProjectReport,
  SiteReport,
  NurseryReport,
  FinancialReport,
  DisturbanceReport,
  SrpReport,
  UpdateRequest,
  FundingProgramme
];

/**
 * TM-3998: Replaces the terrafund, terrafund-landscapes and terrafund-3 frameworks with
 * terrafund-non-profits.
 *
 * 1) Creates the terrafund-non-profits framework.
 * 2) Moves the terrafund-3 forms and the terrafund-landscapes financial report form to it.
 * 3) Re-keys framework forms. For every other form of the old frameworks, remaps the answers of
 *    its entities and the content of their non-approved update requests onto the replacement form's
 *    question names (matched by linked field key), then soft deletes the form.
 * 4) Re-keys every non-deleted row with an old framework_key (entities, reports, update requests,
 *    funding programmes, polygon attribute definitions) and about section framework lists.
 * 5) Moves pending scheduled jobs to the new key (one per due date) and removes pending report
 *    reminder jobs.
 * 6) Moves framework_user rows, then deletes the old framework rows (that table has no soft delete).
 *
 * Requires migration 202611041200-widen-framework-key-columns.
 *
 * Run in entity-service REPL:
 *   await oneOff.migrateTerrafundNonProfits()
 *
 * Safe to re-run.
 */
export const migrateTerrafundNonProfits = withoutSqlLogs(async () => {
  await Framework.sequelize?.transaction(async transaction => {
    const oldFrameworks = await Framework.findAll({
      where: { slug: { [Op.in]: OLD_KEYS } } as WhereOptions,
      transaction
    });
    const findOld = (slug: string) => oldFrameworks.find(framework => framework.slug === slug);
    const tf3 = findOld(TERRAFUND_3);
    const landscapes = findOld(LANDSCAPES);

    const [framework] = await Framework.findOrCreate({
      where: { slug: TERRAFUND_NON_PROFITS },
      defaults: {
        slug: TERRAFUND_NON_PROFITS,
        accessCode: TERRAFUND_NON_PROFITS,
        name: FRAMEWORK_NAMES[TERRAFUND_NON_PROFITS]
      },
      transaction
    });

    await moveForms(framework, tf3, landscapes, transaction);
    await rekeyRows(transaction);
    await migrateScheduledJobs(transaction);
    await migrateFrameworkUsers(framework, oldFrameworks, transaction);

    await Framework.destroy({ where: { id: oldFrameworks.map(({ id }) => id) }, transaction });
    console.log(`Deleted old frameworks: ${oldFrameworks.map(({ slug }) => slug).join(", ")}`);
  });
});

async function moveForms(
  framework: Framework,
  tf3: Framework | undefined,
  landscapes: Framework | undefined,
  transaction: Transaction
) {
  if (tf3 != null) {
    for (const column of TF3_FORM_COLUMNS) {
      framework[column] = tf3[column];
    }
  }
  if (landscapes != null) {
    framework.financialReportFormUuid = landscapes.financialReportFormUuid;
  }
  await framework.save({ transaction });

  const movedUuids = [...TF3_FORM_COLUMNS, "financialReportFormUuid" as const]
    .map(column => framework[column])
    .filter((uuid): uuid is string => uuid != null);
  const [moved] = await Form.update(
    { frameworkKey: TERRAFUND_NON_PROFITS },
    { where: { uuid: movedUuids }, silent: true, transaction }
  );
  const [applications] = await Form.update(
    { frameworkKey: TERRAFUND_NON_PROFITS },
    { where: { ...OLD_KEYS_WHERE, stageId: { [Op.ne]: null } }, silent: true, transaction }
  );

  // At this point, the only forms left on the old keys are the ones being replaced.
  const replacedForms = await Form.findAll({
    where: OLD_KEYS_WHERE,
    attributes: ["uuid", "model", "frameworkKey"],
    transaction
  });
  const replacements = await Form.findAll({ where: { uuid: movedUuids }, attributes: ["uuid", "model"], transaction });
  for (const form of replacedForms) {
    const replacement = replacements.find(({ model }) => model === form.model);
    if (replacement == null) {
      console.log(`No replacement form, answers not migrated [uuid=${form.uuid}, model=${form.model}]`);
      continue;
    }

    await migrateAnswers(form, replacement, transaction);
  }

  const deleted = await Form.destroy({ where: OLD_KEYS_WHERE, transaction });
  console.log(`Forms: ${moved} moved, ${applications} application forms re-keyed, ${deleted} soft deleted`);
}

async function migrateAnswers(form: Form, replacement: Form, transaction: Transaction) {
  const modelClass = LARAVEL_MODELS[form.model ?? ""] as typeof Project | undefined;
  if (modelClass == null || form.model == null || form.frameworkKey == null) {
    console.log(`Unsupported form, answers not migrated [uuid=${form.uuid}, model=${form.model}]`);
    return;
  }

  const [oldQuestions, newQuestions] = await Promise.all(
    [form.uuid, replacement.uuid].map(uuid =>
      FormQuestion.forForm(uuid).findAll({
        where: { linkedFieldKey: { [Op.ne]: null } },
        attributes: ["uuid", "name", "linkedFieldKey"],
        transaction
      })
    )
  );
  const formNames: Dictionary<string> = {};
  let unmatched = 0;
  for (const question of oldQuestions) {
    const newQuestion = newQuestions.find(({ linkedFieldKey }) => linkedFieldKey === question.linkedFieldKey);
    if (newQuestion == null) unmatched++;
    else if (newQuestion.formName !== question.formName) formNames[question.formName] = newQuestion.formName;
  }

  // Entities are paged by id directly because the paginated query builder doesn't support transactions.
  let entities = 0;
  let lastId = 0;
  for (;;) {
    const page = await modelClass.findAll({
      where: { id: { [Op.gt]: lastId }, frameworkKey: form.frameworkKey, answers: { [Op.ne]: null } },
      attributes: ["id", "answers"],
      order: [["id", "ASC"]],
      limit: 100,
      transaction
    });
    if (page.length === 0) break;

    for (const entity of page) {
      const answers = remapFormNames(entity.answers ?? {}, formNames);
      if (answers == null) continue;

      await entity.update({ answers }, { silent: true, transaction });
      entities++;
    }
    lastId = page[page.length - 1].id;
  }

  const updateRequests = await UpdateRequest.findAll({
    where: {
      updateRequestableType: form.model,
      updateRequestableId: { [Op.in]: Subquery.select(modelClass, "id").eq("frameworkKey", form.frameworkKey).literal },
      status: { [Op.ne]: "approved" },
      content: { [Op.ne]: null }
    },
    attributes: ["id", "content"],
    transaction
  });
  let updatedRequests = 0;
  for (const updateRequest of updateRequests) {
    const content = remapFormNames(updateRequest.content ?? {}, formNames);
    if (content == null) continue;

    await updateRequest.update({ content }, { silent: true, transaction });
    updatedRequests++;
  }

  console.log(
    `Answers [${form.frameworkKey}, ${form.model}]: ${entities} entities and ${updatedRequests} update requests ` +
      `updated, ${unmatched} linked questions without a match in the replacement form`
  );
}

/**
 * Returns the values with the old form names replaced by the new ones, or undefined if nothing changed.
 * A value already present under a new form name is not overwritten.
 */
function remapFormNames(values: Dictionary<unknown>, formNames: Dictionary<string>) {
  const oldNames = Object.keys(values).filter(name => formNames[name] != null);
  if (oldNames.length === 0) return undefined;

  const remapped = Object.fromEntries(Object.entries(values).filter(([name]) => formNames[name] == null));
  for (const name of oldNames) {
    remapped[formNames[name]] ??= values[name];
  }
  return remapped;
}

async function rekeyRows(transaction: Transaction) {
  for (const model of REKEYED_MODELS) {
    const [count] = await (model as typeof Project).update(
      { frameworkKey: TERRAFUND_NON_PROFITS },
      { where: OLD_KEYS_WHERE, silent: true, transaction }
    );
    console.log(`${model.name}: ${count} rows re-keyed`);
  }

  // Polygon attribute definitions are unique per framework and key, so a definition whose key the
  // new framework already has is left in place for manual review.
  const definitions = await PolygonAttributeDefinition.findAll({
    where: { [Op.or]: [OLD_KEYS_WHERE, { frameworkKey: TERRAFUND_NON_PROFITS }] },
    attributes: ["id", "key", "frameworkKey"],
    transaction
  });
  const takenKeys = new Set(
    definitions.filter(({ frameworkKey }) => frameworkKey === TERRAFUND_NON_PROFITS).map(({ key }) => key)
  );
  for (const definition of definitions.filter(({ frameworkKey }) => frameworkKey !== TERRAFUND_NON_PROFITS)) {
    if (takenKeys.has(definition.key)) {
      console.log(`Polygon attribute definition conflict, not re-keyed [id=${definition.id}, key=${definition.key}]`);
      continue;
    }
    await definition.update({ frameworkKey: TERRAFUND_NON_PROFITS }, { silent: true, transaction });
    takenKeys.add(definition.key);
  }

  const aboutSections = await AboutSection.findAll({ attributes: ["id", "frameworks"], transaction });
  for (const section of aboutSections) {
    const frameworks = section.frameworks as string[] | null;
    if (frameworks == null || !frameworks.some(key => OLD_KEYS.includes(key))) continue;

    section.frameworks = uniq(
      frameworks.map(key => (OLD_KEYS.includes(key) ? TERRAFUND_NON_PROFITS : key))
    ) as FrameworkKey[];
    await section.save({ silent: true, transaction });
  }
}

async function migrateScheduledJobs(transaction: Transaction) {
  const reminders = await ScheduledJob.destroy({ where: { type: REPORT_REMINDER } as WhereOptions, transaction });
  console.log(`Scheduled jobs: ${reminders} pending report reminders removed`);

  const jobs = await ScheduledJob.findAll({
    where: { "taskDefinition.frameworkKey": { [Op.in]: [...OLD_KEYS, TERRAFUND_NON_PROFITS] } },
    order: [["executionTime", "ASC"]],
    transaction
  });
  const existing = new Set<string>();
  const jobKey = ({ type, executionTime, taskDefinition }: ScheduledJob) =>
    type === TASK_DUE && "dueAt" in taskDefinition
      ? `${type}|${taskDefinition.dueAt}`
      : `${type}|${executionTime.toISOString()}`;
  for (const job of jobs.filter(({ taskDefinition }) => taskDefinition.frameworkKey === TERRAFUND_NON_PROFITS)) {
    existing.add(jobKey(job));
  }

  let moved = 0;
  let removed = 0;
  for (const job of jobs.filter(({ taskDefinition }) => taskDefinition.frameworkKey !== TERRAFUND_NON_PROFITS)) {
    const key = jobKey(job);
    if (existing.has(key)) {
      await job.destroy({ transaction });
      removed++;
    } else {
      job.taskDefinition = { ...job.taskDefinition, frameworkKey: TERRAFUND_NON_PROFITS };
      await job.save({ transaction });
      existing.add(key);
      moved++;
    }
  }
  console.log(`Scheduled jobs: ${moved} moved, ${removed} duplicates removed`);
}

async function migrateFrameworkUsers(framework: Framework, oldFrameworks: Framework[], transaction: Transaction) {
  const oldFrameworkIds = oldFrameworks.map(({ id }) => id);
  const frameworkUsers = await FrameworkUser.findAll({
    where: { frameworkId: [...oldFrameworkIds, framework.id] },
    attributes: ["userId", "frameworkId"],
    transaction
  });
  const currentUserIds = frameworkUsers
    .filter(({ frameworkId }) => frameworkId === framework.id)
    .map(({ userId }) => userId);
  const toCreate = difference(uniq(frameworkUsers.map(({ userId }) => userId)), currentUserIds);
  await FrameworkUser.bulkCreate(
    toCreate.map(userId => ({ userId, frameworkId: framework.id }) as FrameworkUser),
    {
      transaction
    }
  );
  await FrameworkUser.destroy({ where: { frameworkId: oldFrameworkIds }, transaction });
  console.log(`Framework users: ${toCreate.length} moved`);
}
