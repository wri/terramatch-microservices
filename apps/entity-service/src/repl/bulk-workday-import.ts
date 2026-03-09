import { FileService } from "@terramatch-microservices/common/file/file.service";
import { parseCsv } from "@terramatch-microservices/common/util/repl/parse-csv";
import {
  PAID_NURSERY_OPERATIONS,
  PAID_OTHER,
  PAID_PLANTING,
  PAID_PROJECT_MANAGEMENT,
  PAID_SITE_ESTABLISHMENT,
  PAID_SITE_MAINTENANCE,
  PAID_SITE_MONITORING,
  VOLUNTEER_NURSERY_OPERATIONS,
  VOLUNTEER_OTHER,
  VOLUNTEER_PLANTING,
  VOLUNTEER_PROJECT_MANAGEMENT,
  VOLUNTEER_SITE_ESTABLISHMENT,
  VOLUNTEER_SITE_MAINTENANCE,
  VOLUNTEER_SITE_MONITORING
} from "@terramatch-microservices/database/constants/demographic-collections";
import {
  Form,
  FormQuestion,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  Tracking,
  TrackingEntry
} from "@terramatch-microservices/database/entities";
import { Dictionary, intersection, isEqualWith, uniq } from "lodash";
import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes, CreationAttributes } from "sequelize";
import { DateTime } from "luxon";
import { Valid } from "luxon/src/_util";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { LaravelModelCtor } from "@terramatch-microservices/database/types/util";

type ModelConfig<M extends Model> = {
  model: LaravelModelCtor & ModelCtor<M>;
  parentAssociation: keyof Attributes<M>;
  parentIdColumn: string;
  reportIdColumn: string;
  collections: Dictionary<string>;
};

type ModelConfigs = {
  sites: ModelConfig<SiteReport>;
  projects: ModelConfig<ProjectReport>;
};

type SupportedType = keyof ModelConfigs;
type SupportedModel = InstanceType<ModelConfigs[SupportedType]["model"]>;

const MODEL_CONFIGS: ModelConfigs = {
  sites: {
    model: SiteReport,
    parentAssociation: "site",
    parentIdColumn: "site_id",
    reportIdColumn: "report_id",
    collections: {
      Paid_site_establishment: PAID_SITE_ESTABLISHMENT,
      Vol_site_establishment: VOLUNTEER_SITE_ESTABLISHMENT,
      Paid_planting: PAID_PLANTING,
      Vol_planting: VOLUNTEER_PLANTING,
      Paid_monitoring: PAID_SITE_MONITORING,
      Vol_monitoring: VOLUNTEER_SITE_MONITORING,
      Paid_maintenance: PAID_SITE_MAINTENANCE,
      Vol_maintenance: VOLUNTEER_SITE_MAINTENANCE,
      Paid_other: PAID_OTHER,
      Vol_other: VOLUNTEER_OTHER
    }
  },

  projects: {
    model: ProjectReport,
    parentAssociation: "project",
    parentIdColumn: "project_id",
    reportIdColumn: "report_id",
    collections: {
      Paid_project_management: PAID_PROJECT_MANAGEMENT,
      Vol_project_management: VOLUNTEER_PROJECT_MANAGEMENT,
      Paid_nursery_ops: PAID_NURSERY_OPERATIONS,
      Vol_nursery_ops: VOLUNTEER_NURSERY_OPERATIONS,
      Paid_seed_collection: PAID_NURSERY_OPERATIONS,
      Vol_seed_collection: VOLUNTEER_NURSERY_OPERATIONS,
      Paid_other: PAID_OTHER,
      Vol_other: VOLUNTEER_OTHER
    }
  }
};

type Entry = {
  type: string;
  subtype: string;
  name?: string;
};

type Workday = {
  collection: string;
  entries: Omit<CreationAttributes<TrackingEntry>, "trackingId">[];
};

const DEMOGRAPHICS = {
  women: { type: "gender", subtype: "female" },
  men: { type: "gender", subtype: "male" },
  "non-binary": { type: "gender", subtype: "non-binary" },
  nonbinary: { type: "gender", subtype: "non-binary" },
  "gender-unknown": { type: "gender", subtype: "unknown" },
  "no-gender": { type: "gender", subtype: "unknown" },

  "youth_15-24": { type: "age", subtype: "youth" },
  "adult_24-64": { type: "age", subtype: "adult" },
  "elder_65+": { type: "age", subtype: "elder" },
  "age-unknown": { type: "age", subtype: "unknown" },
  age_unknown: { type: "age", subtype: "unknown" },

  indigenous: { type: "ethnicity", subtype: "indigenous" },
  "ethnicity-other": { type: "ethnicity", subtype: "other" },
  "ethnicity-unknown": { type: "ethnicity", subtype: "unknown" }
} as const;

const LOGGER = new TMLogger("Bulk PPC Workday Import");

/**
 * This script is meant to run in the REPL:
 * > await bulkWorkdayImport(await resolve(FileService), 'path-to.csv'));
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const bulkWorkdayImport = withoutSqlLogs(
  async (fileService: FileService, csvPath: string, type: SupportedType, dryRun?: boolean) => {
    let rowCount = 0;
    const warnings: string[] = [];
    const workdays: Record<number, Workday[]> = {};
    try {
      const config = MODEL_CONFIGS[type];

      await parseCsv(fileService, csvPath, async row => {
        rowCount++;
        const result = await parseRow(config, row);
        warnings.push(...result.warnings);
        assert(workdays[result.reportId] == null, `Duplicate report ID: ${result.reportId} [row ${rowCount + 1}]`);

        if (result.workdays.length === 0) {
          warnings.push(`No workdays found for report ID: ${result.reportId} [row ${rowCount + 1}]`);
        } else workdays[result.reportId] = result.workdays;
      });

      LOGGER.log(`Processed ${rowCount} rows from ${csvPath}`);

      if (warnings.length > 0) {
        LOGGER.warn("Warnings:");
        for (const warning of warnings) LOGGER.warn(`${warning}`);
      }

      if (dryRun) {
        LOGGER.log("Dry run complete. No workdays were persisted.");
        LOGGER.log(`Workdays parsed:\n${JSON.stringify(workdays, null, 2)}`);
      } else {
        LOGGER.log("Persisting workdays...");
        await persistWorkdays(config, workdays);
      }
    } catch (err) {
      LOGGER.error(`Error processing CSV at ${csvPath} row ${rowCount + 1}: ${err.message}`);
    }
  }
);

const columnValue = (row: Dictionary<string>, columnName: string) => {
  assert(columnName in row, `Column ${columnName} not found.`);
  return row[columnName] === "" ? null : row[columnName];
};

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const assertNotNull = <T>(value: T | null | undefined, message: string): T => {
  assert(value != null, message);
  return value as T;
};

const assertNumber = (value: string | null, message: string) => {
  const stringValue = assertNotNull(value, message);
  assert(!isNaN(Number(stringValue)), message);
  return Number(stringValue);
};

const assertDate = (value: string | null, message: string, format = "M/d/yy") => {
  const stringValue = assertNotNull(value, message);
  const result = DateTime.fromFormat(stringValue, format);
  assert(result.isValid, message);
  return result as DateTime<Valid>;
};

const assertEntry = (demographicName: string, header: string, row: Dictionary<string>): Entry => {
  const entry = DEMOGRAPHICS[demographicName];
  if (entry != null) return entry;

  if (demographicName.startsWith("ethnicity-unknown") || demographicName.startsWith("ethnicity-decline")) {
    return DEMOGRAPHICS["ethnicity-unknown"];
  }

  const name = assertNotNull(columnValue(row, demographicName), `Demographic name not found: ${demographicName}`);
  if (demographicName.startsWith("indigenous")) {
    return { ...DEMOGRAPHICS.indigenous, name };
  }
  if (demographicName.startsWith("other-ethnicity") || demographicName.startsWith("ethnicity-other")) {
    return { ...DEMOGRAPHICS["ethnicity-other"], name };
  }

  throw new Error(`Unknown demographic: ${header}`);
};

const entryMatcher = (a: Entry) => (b: CreationAttributes<TrackingEntry>) =>
  isEqualWith(
    { type: a.type, subtype: a.subtype, name: a.name },
    { type: b.type, subtype: b.subtype, name: b.name },
    (valueA, valueB) => (valueA == null && valueB == null ? true : undefined)
  );

const parseRow = async (config: ModelConfigs[SupportedType], row: Dictionary<string>) => {
  const parentId = assertNumber(columnValue(row, config.parentIdColumn), "Parent ID not found or malformed");
  const reportId = assertNumber(columnValue(row, config.reportIdColumn), "Report ID not found or malformed");
  const dueDate = assertDate(columnValue(row, "due_date"), "Due date not found");

  const report = assertNotNull(
    (await (config.model as ModelCtor).findOne({
      where: { id: reportId },
      attributes: ["id", "dueAt"],
      include: [{ association: config.parentAssociation, attributes: ["ppcExternalId"] }]
    })) as SupportedModel | null,
    "Report not found"
  );
  const parent = assertNotNull(report?.[config.parentAssociation] as Site | Project | null, "Parent not found");
  assert(parent.ppcExternalId === parentId, "Parent ID does not match");

  const reportDueAt = report.dueAt == null ? null : DateTime.fromJSDate(report.dueAt).setZone("UTC");
  const datesMatch =
    reportDueAt != null &&
    reportDueAt.year === dueDate.year &&
    reportDueAt.month === dueDate.month &&
    reportDueAt.day === dueDate.day;
  assert(datesMatch, `Due date does not match [db=${reportDueAt}, csv=${dueDate}]`);

  const entriesByCollection: Dictionary<Omit<CreationAttributes<TrackingEntry>, "trackingId">[]> = {};
  const collectionKeys = Object.keys(config.collections);
  for (const [header, value] of Object.entries(row)) {
    if (!header.startsWith("Paid_") && !header.startsWith("Vol_")) continue;
    if (value === "" || value === "-") continue;

    const columnTitlePrefix = assertNotNull(
      collectionKeys.find(key => header.startsWith(key)),
      `Collection not found: ${header}`
    );
    const collection = config.collections[columnTitlePrefix];
    const demographicName = header.substring(columnTitlePrefix.length + 1);
    const entry = assertEntry(demographicName, header, row);
    const amount = Math.round(assertNumber(value, `Amount invalid [${value}]`));
    assert(amount >= 0, "Amount must be non-negative");

    const entries = (entriesByCollection[collection] ??= []);
    const existing = entries.find(entryMatcher(entry));
    if (existing != null) {
      existing.amount += amount;
    } else {
      entries.push({ ...entry, amount });
    }
  }

  // Check for balanced workdays
  const warnings: string[] = [];
  for (const [collection, entries] of Object.entries(entriesByCollection)) {
    const totals = {
      gender: 0,
      age: 0,
      ethnicity: 0
    };
    for (const { type, amount } of entries) {
      totals[type] += amount;
    }

    if (uniq(Object.values(totals)).length > 1) {
      let message = "Demographics for collection are unbalanced\n";
      if (totals.gender < totals.age || totals.gender < totals.ethnicity) {
        message += "GENDER IS NOT THE LARGEST VALUE IN THIS COLLECTION\n";
      }
      message += JSON.stringify({ reportId, collection, totals }, null, 2);
      warnings.push(message);
    }
  }

  const workdays: Workday[] = Object.entries(entriesByCollection).map(([collection, entries]) => ({
    collection,
    entries
  }));
  return { reportId, workdays, warnings };
};

const persistWorkdays = async (config: ModelConfigs[SupportedType], reportWorkdays: Record<number, Workday[]>) => {
  const attributes = intersection(Object.keys((config.model as ModelCtor).getAttributes()), [
    "id",
    "uuid",
    "frameworkKey",
    "answers",
    "nothingToReport"
  ]);
  for (const [reportId, workdays] of Object.entries(reportWorkdays)) {
    const report = (await (config.model as ModelCtor).findOne({
      where: { id: Number(reportId) },
      attributes
    })) as SupportedModel;
    const modelDescription = `${config.model.name} [id=${report.id}, uuid=${report.uuid}]`;

    LOGGER.log(`Persisting workdays for ${modelDescription}...`);
    const collectionsCreated: string[] = [];
    for (const { collection, entries } of workdays) {
      const exists =
        (await Tracking.for(report).domain("demographics").type("workdays").collection(collection).count()) > 0;
      if (exists) {
        LOGGER.warn(
          `Tracking already exists, skipping this row [reportId=${
            report.id
          }, collection=${collection}]\n${JSON.stringify(entries, null, 2)}`
        );
        continue;
      }

      LOGGER.log(`Creating workdays for ${collection}`);
      collectionsCreated.push(collection);
      const tracking = await Tracking.create({
        trackableType: config.model.LARAVEL_TYPE,
        trackableId: report.id,
        domain: "demographics",
        type: "workdays",
        collection
      });
      await TrackingEntry.bulkCreate(entries.map(entry => ({ ...entry, trackingId: tracking.id })));
    }

    // Make sure the report is no longer set to "nothing to report"
    if (attributes.includes("nothingToReport")) {
      (report as { nothingToReport: boolean }).nothingToReport = false;
    }

    const questions = await FormQuestion.forForm(Form.uuidFor(report)).findAll({
      where: {
        inputType: "workdays",
        collection: collectionsCreated
      },
      attributes: ["showOnParentCondition", "parentId"]
    });
    const answers = { ...report.answers };
    for (const { showOnParentCondition, parentId } of questions) {
      if (parentId == null) continue;

      // Make sure all relevant demographic questions are unhidden.
      answers[parentId] = showOnParentCondition ?? true;
    }
    report.answers = answers;

    await report.save();

    LOGGER.log(`Persistence complete for ${modelDescription}`);
  }
};
