import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Dictionary } from "lodash";
import { writeCsv } from "@terramatch-microservices/common/util/repl/csv";
import { timestampFileName } from "@terramatch-microservices/common/util/fileNames";
import { Op } from "sequelize";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { FinancialReport, Form, FormQuestion, UpdateRequest } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { AddRow } from "@terramatch-microservices/common/export/csv-export.service";
import { formModelType, isEntity, isLinkedEntityModel } from "@terramatch-microservices/database/constants/entities";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { ConfigService } from "@nestjs/config";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";

const REPORT_COLUMNS = {
  entityType: "Entity Type",
  entityUuid: "Entity UUID",
  frameworkKey: "Framework Key",
  linkToAdmin: "Link to Admin",
  linkedFieldKey: "Linked Field Key",
  linkedFieldTitle: "Question Title",
  unmigratedValue: "Unmigrated Value",
  reason: "Reason Migration Not Possible"
} as const;

type ReportRow = Record<keyof typeof REPORT_COLUMNS, unknown>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Script to find update request data that points to deleted or no longer in use questions, and
 * looks for the correct question UUID to use in its place. May be run periodically. Produces a
 * report that lists the data that was _not_ able to be migrated. If `cleanUnmigratedData` is true,
 * the unmigrated data will be deleted.
 */
export const updateRequestDataFix = withoutSqlLogs(async (cleanUnmigratedData = false) => {
  const reportFilename = timestampFileName("Update Request Data Fix Report");
  const reportDownloadUrl = await writeCsv(reportFilename, REPORT_COLUMNS, async addRow => {
    await processUpdateRequests(cleanUnmigratedData, addRow);
  });

  if (reportDownloadUrl == null) {
    console.log(`Result CSV is available at: ./${reportFilename}`);
  } else {
    console.log(`Download URL for result CSV: ${reportDownloadUrl}`);
  }
});

const processUpdateRequests = async (cleanUnmigratedData: boolean, addRow: AddRow) => {
  const cleanUpdateRequests: Dictionary<number[]> = {};
  const builder = new PaginatedQueryBuilder(UpdateRequest, 10).where({
    status: { [Op.ne]: "approved" }
  });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Update Requests: [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const updateRequest of page) {
      const rows = await processUpdateRequest(updateRequest, cleanUnmigratedData);
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

const processUpdateRequest = async (
  updateRequest: UpdateRequest,
  cleanUnmigratedData: boolean
): Promise<ReportRow[] | undefined> => {
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
  const reportRows: ReportRow[] = [];
  for (const [questionUuid, value] of Object.entries(content)) {
    // Some really old update requests have content that is not keyed on the question UUID.
    if (!UUID_REGEX.test(questionUuid)) continue;

    // The question exists in the current form, pass over this entry
    if (questions.find(question => question.uuid === questionUuid) != null) continue;

    foundContentToMigrate = true;
    const originalQuestion = await FormQuestion.findOne({ paranoid: false, where: { uuid: questionUuid } });
    if (originalQuestion == null) {
      reportRows.push({
        ...rowData,
        reason: `Original question not found: ${questionUuid}`,
        linkedFieldKey: undefined,
        linkedFieldTitle: undefined,
        unmigratedValue: value
      });
      continue;
    }

    const { linkedFieldKey } = originalQuestion;
    if (linkedFieldKey == null) {
      reportRows.push({
        ...rowData,
        reason: `Unable to migrate question without a linked field key: ${originalQuestion.inputType}`,
        linkedFieldKey: undefined,
        linkedFieldTitle: undefined,
        unmigratedValue: value
      });
      continue;
    }

    // table input can be ignored - the questions inside the table are what matters.
    if (linkedFieldKey === "table-input") continue;
    // We no longer collect boundary geojson anywhere, this can be removed
    if (linkedFieldKey === "site-boundary-geojson") {
      // TODO: remove from content
      continue;
    }

    const currentQuestion = questions.find(question => question.linkedFieldKey === linkedFieldKey);
    if (currentQuestion == null) {
      reportRows.push({
        ...rowData,
        reason: "Question with this linked field key not found in current form",
        linkedFieldKey,
        linkedFieldTitle: getLinkedFieldConfig(linkedFieldKey)?.field.label,
        unmigratedValue: value
      });
      continue;
    }

    // TODO: do data migration / cleaning
    content[currentQuestion.uuid] = content[questionUuid];
    delete content[questionUuid];
  }

  if (!foundContentToMigrate) {
    // If we didn't find any content to migrate, return undefined to indicate that this update request was clean.
    return undefined;
  }

  await updateRequest.update({ content });
  return reportRows;
};
