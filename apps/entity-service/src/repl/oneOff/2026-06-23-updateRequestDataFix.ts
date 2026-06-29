import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Dictionary, isObject, isString } from "lodash";
import { writeCsv } from "@terramatch-microservices/common/util/repl/csv";
import { timestampFileName } from "@terramatch-microservices/common/util/fileNames";
import { Op } from "sequelize";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { FinancialReport, Form, FormQuestion, UpdateRequest } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { AddRow } from "@terramatch-microservices/common/export/csv-export.service";
import {
  FormModelType,
  formModelType,
  isEntity,
  isLinkedEntityModel
} from "@terramatch-microservices/database/constants/entities";
import { LARAVEL_MODEL_TYPES, LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { ConfigService } from "@nestjs/config";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { LinkedAnswerCollector } from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

const REPORT_COLUMNS = {
  entityType: "Entity Type",
  entityUuid: "Entity UUID",
  frameworkKey: "Framework Key",
  linkToAdmin: "Link to Admin",
  linkedFieldKey: "Linked Field Key",
  linkedFieldTitle: "Question Title",
  reason: "Reason Migration Not Possible",
  unmigratedValue: "Unmigrated Value"
} as const;

type ReportRow = Record<keyof typeof REPORT_COLUMNS, unknown>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DataMigration = {
  targetLinkedFieldKey: string;
  mungeData?: (value: unknown) => unknown;
};

const DATA_MIGRATIONS: Dictionary<DataMigration[]> = {
  "pro-country": [
    {
      targetLinkedFieldKey: "pro-level-0-project",
      mungeData: value => {
        if (value == null) return value;
        if (typeof value !== "string" || value.length !== 3) {
          throw new UnmigratableDataError("Value is not a GADM level 0 code");
        }
        return [value];
      }
    }
  ],
  "site-rep-col-photos": [{ targetLinkedFieldKey: "site-rep-col-media" }]
};

// The existence of any of these in an update request triggers logic to copy all existing tracking
// data from the base entity to the update request, making sure not to overwrite data that's in the
// update request.
const TRACKING_LINKED_FIELD_KEYS = [
  "pro-goal-trees-restored-anr",
  "pro-goal-trees-restored-direct-seeding",
  "pro-goal-trees-restored-planting",
  "pro-jobs-created-goal",
  "pro-rep-beneficiaries",
  "pro-rep-beneficiaries-large-scl",
  "pro-rep-beneficiaries-men",
  "pro-rep-beneficiaries-non-youth",
  "pro-rep-beneficiaries-other",
  "pro-rep-beneficiaries-smallholder",
  "pro-rep-beneficiaries-training-men",
  "pro-rep-beneficiaries-training-non-youth",
  "pro-rep-beneficiaries-training-other",
  "pro-rep-beneficiaries-training-women",
  "pro-rep-beneficiaries-training-youth",
  "pro-rep-beneficiaries-women",
  "pro-rep-beneficiaries-youth",
  "pro-rep-beneficiaries_scstobc",
  "pro-rep-beneficiaries_scstobc_farmers",
  "pro-rep-ft-men",
  "pro-rep-ft-non-youth",
  "pro-rep-ft-other",
  "pro-rep-ft-total",
  "pro-rep-ft-women",
  "pro-rep-ft-youth",
  "pro-rep-ind-2",
  "pro-rep-people_knowledge-skills-increased",
  "pro-rep-pt-men",
  "pro-rep-pt-non-youth",
  "pro-rep-pt-other",
  "pro-rep-pt-total",
  "pro-rep-pt-women",
  "pro-rep-pt-youth",
  "pro-rep-volunteer-men",
  "pro-rep-volunteer-non-youth",
  "pro-rep-volunteer-total",
  "pro-rep-volunteer-women",
  "pro-rep-volunteer-youth",
  "pro-rep-volunteer_other",
  "pro-rep-workdays-paid",
  "pro-rep-workdays-volunteer",
  "pro-total-hectares-restored-goal",
  "pro-trees-grown-goal",
  "site-rep-workdays-paid",
  "site-rep-workdays-volunteer"
];

// These have been moved to other reports and should just be ignored (or removed if cleaning unmigrated data)
const IGNORED_LINKED_FIELD_KEYS = [
  "table-input",
  "site-boundary-geojson",
  "nur-rep-seedlings-young-trees",
  "pro-beneficiaries",
  "pro-community-incentives",
  "pro-environmental-goals",
  "pro-history",
  "pro-land-use-types",
  "pro-pct-beneficiaries-35below",
  "pro-pct-beneficiaries-large",
  "pro-pct-beneficiaries-small",
  "pro-pct-beneficiaries-women",
  "pro-pct-employees-18to35",
  "pro-pct-employees-men",
  "pro-pct-employees-older35",
  "pro-pct-employees-women",
  "pro-rep-beneficiaries-income-inc",
  "pro-rep-beneficiaries-skill-inc",
  "pro-rep-direct-benefits-partners",
  "pro-rep-direct-capacity-partners",
  "pro-rep-direct-conservation-payments-partners",
  "pro-rep-direct-income-partners",
  "pro-rep-direct-land-title-partners",
  "pro-rep-direct-livelihoods-partners",
  "pro-rep-direct-market-access-partners",
  "pro-rep-direct-other-partners",
  "pro-rep-direct-productivity-partners",
  "pro-rep-direct-training-partners",
  "pro-rep-indirect-benefits-partners",
  "pro-rep-indirect-capacity-partners",
  "pro-rep-indirect-conservation-payments-partners",
  "pro-rep-indirect-income-partners",
  "pro-rep-indirect-land-title-partners",
  "pro-rep-indirect-livelihoods-partners",
  "pro-rep-indirect-market-access-partners",
  "pro-rep-indirect-other-partners",
  "pro-rep-indirect-productivity-partners",
  "pro-rep-indirect-training-partners",
  "pro-rep-maint-mon-act",
  "pro-rep-other-restoration-partners-description",
  "pro-rep-pct-surv",
  "pro-rep-surv-calc",
  "pro-rep-surv-comp",
  "pro-rep-total-unique-restoration-partners",
  "pro-restoration_strategy",
  "pro-socioeconomic-goals",
  "site-landscape-community-contribution",
  "site-rel-disturbances",
  "site-rep-rel-disturbances",
  "site-rep-technical-narrative",
  "site-rep-num-trees-regenerating",
  "pro-rep-beneficiaries-income-desc"
];

class UnmigratableDataError extends Error {}

export const updateRequestDataFix = withoutSqlLogs(async () => {
  const reportFilename = timestampFileName("Update Request Data Fix Report");
  const reportDownloadUrl = await writeCsv(reportFilename, REPORT_COLUMNS, async addRow => {
    await processUpdateRequests(addRow);
  });

  if (reportDownloadUrl == null) {
    console.log(`Result CSV is available at: ./${reportFilename}`);
  } else {
    console.log(`Download URL for result CSV: ${reportDownloadUrl}`);
  }
});

const processUpdateRequests = async (addRow: AddRow) => {
  const cleanUpdateRequests: Dictionary<number[]> = {};
  const builder = new PaginatedQueryBuilder(UpdateRequest, 10).where({
    status: { [Op.ne]: "approved" }
  });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Update Requests: [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const updateRequest of page) {
      const rows = await processUpdateRequest(updateRequest);
      if (rows != null) {
        if (rows.length === 0) {
          (cleanUpdateRequests[updateRequest.updateRequestableType] ??= []).push(updateRequest.id);
        } else {
          rows.map(row => addRow(row as Dictionary<unknown>));
        }
      }

      bar.tick();
    }
  }
};

const processUpdateRequest = async (updateRequest: UpdateRequest): Promise<ReportRow[] | undefined> => {
  const entity = await LARAVEL_MODELS[updateRequest.updateRequestableType]?.findOne({
    where: { id: updateRequest.updateRequestableId }
  });
  if (entity == null || !isEntity(entity)) return undefined;

  if (entity instanceof FinancialReport) {
    // required to find the correct form
    entity.organisation = await entity.$get("organisation", { attributes: ["type"] });
  }

  const frontEndUrl = getService(ConfigService).get<string>("APP_FRONT_END") ?? "https://www.terramatch.org";
  const rowData = {
    entityType: formModelType(entity),
    entityUuid: entity.uuid,
    frameworkKey: entity.frameworkKey,
    linkToAdmin: isLinkedEntityModel(entity) ? entity.linkToTerramatch(frontEndUrl) : undefined
  };

  const questions = await FormQuestion.forForm(Form.uuidFor(entity)).findAll();
  const content = { ...updateRequest.content };
  let foundContentToMigrate = false;
  let migrateTrackingData = false;
  const reportRows: ReportRow[] = [];
  for (const [questionUuid, value] of Object.entries(content)) {
    // Some really old update requests have content that is not keyed on the question UUID.
    if (!UUID_REGEX.test(questionUuid)) continue;

    // The question exists in the current form, pass over this entry
    if (questions.find(question => question.uuid === questionUuid) != null) continue;

    const reportValue = isObject(value) ? JSON.stringify(value) : isString(value) ? `"${value}"` : value;
    foundContentToMigrate = true;
    let linkedFieldKey: string;
    try {
      linkedFieldKey = await findLinkedFieldKey(questionUuid);
    } catch (e) {
      if (!(e instanceof UnmigratableDataError)) throw e;

      reportRows.push({
        ...rowData,
        reason: e.message,
        linkedFieldKey: undefined,
        linkedFieldTitle: undefined,
        unmigratedValue: reportValue
      });
      continue;
    }

    if (TRACKING_LINKED_FIELD_KEYS.includes(linkedFieldKey)) {
      migrateTrackingData = true;
      continue;
    }

    try {
      const migrationResult = migrateData(linkedFieldKey, value, questions);
      // only send the value if another hasn't been provided for this question.
      if (migrationResult != null && content[migrationResult.name] == null) {
        content[migrationResult.name] = migrationResult.value;
        delete content[questionUuid];
      }
    } catch (e) {
      if (!(e instanceof UnmigratableDataError)) throw e;

      reportRows.push({
        ...rowData,
        reason: e.message,
        linkedFieldKey,
        linkedFieldTitle: getLinkedFieldConfig(linkedFieldKey)?.field.label,
        unmigratedValue: reportValue
      });
    }
  }

  if (!foundContentToMigrate) {
    // If we didn't find any content to migrate, return undefined to indicate that this update request was clean.
    return undefined;
  }

  if (migrateTrackingData) {
    // Filter the questions down to tracking questions that do _not_ have an answer already in the update request content.
    const trackingQuestions = questions.filter(({ uuid, linkedFieldKey }) => {
      if (linkedFieldKey == null) return false;

      const { field } = getLinkedFieldConfig(linkedFieldKey) ?? {};
      return (
        field != null &&
        isRelation(field) &&
        ["demographics", "restoration"].includes(field.resource) &&
        content[uuid] == null
      );
    });
    if (trackingQuestions.length > 0) {
      const conditionals = trackingQuestions.reduce((acc, question) => {
        if (question.parentId == null) return acc;
        return { ...acc, [question.parentId]: content[question.parentId] ?? entity.answers?.[question.parentId] };
      }, {});
      const collector = new LinkedAnswerCollector(getService(MediaService));
      const modelType = LARAVEL_MODEL_TYPES[updateRequest.updateRequestableType] as FormModelType;
      const trackingAnswers = await collector.getAnswers(conditionals, trackingQuestions, { [modelType]: entity });
      for (const [uuid, value] of Object.entries(trackingAnswers)) {
        content[uuid] = value;
      }
    }
  }

  await updateRequest.update({ content });
  return reportRows;
};

const findLinkedFieldKey = async (questionUuid: string) => {
  const originalQuestion = await FormQuestion.findOne({ paranoid: false, where: { uuid: questionUuid } });
  if (originalQuestion == null) throw new UnmigratableDataError(`Original question not found: ${questionUuid}`);

  const { linkedFieldKey } = originalQuestion;
  if (linkedFieldKey == null) {
    throw new UnmigratableDataError(
      `Unable to migrate question without a linked field key: ${originalQuestion.inputType}`
    );
  }

  return linkedFieldKey;
};

const migrateData = (linkedFieldKey: string, value: unknown, questions: FormQuestion[]) => {
  const currentQuestion = questions.find(question => question.linkedFieldKey === linkedFieldKey);
  if (currentQuestion != null) {
    return { name: currentQuestion.formName, value };
  }

  for (const migration of DATA_MIGRATIONS[linkedFieldKey] ?? []) {
    const targetQuestion = questions.find(({ linkedFieldKey }) => linkedFieldKey === migration.targetLinkedFieldKey);
    if (targetQuestion == null) continue;

    const newValue = migration.mungeData == null ? value : migration.mungeData(value);
    return { name: targetQuestion.formName, value: newValue };
  }

  if (!IGNORED_LINKED_FIELD_KEYS.includes(linkedFieldKey)) {
    throw new UnmigratableDataError("No question found in the form for this linked field key");
  }
};
