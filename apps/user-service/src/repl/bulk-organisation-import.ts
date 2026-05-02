import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CreationAttributes } from "sequelize";
import {
  Application,
  FormSubmission,
  FundingProgramme,
  Organisation,
  ProjectPitch,
  Stage
} from "@terramatch-microservices/database/entities";
import { columnValue, parseCsv, writeCsv } from "@terramatch-microservices/common/util/repl/csv";
import { Dictionary } from "lodash";
import {
  assert,
  AssertionError,
  assertMember,
  assertNotNull
} from "@terramatch-microservices/common/util/repl/assertions";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { timestampFileName } from "@terramatch-microservices/common/util/filenames";

const LOGGER = new TMLogger("Bulk Organisation Import");

const VALID_TYPES = ["non-profit-organization", "for-profit-organization"];

type Row = {
  org: CreationAttributes<Organisation>;
  fundingProgrammeUuid: string;
  level0Proposed: string[];
  level1Proposed: string[];
};

const EXPORT_COLUMNS: Dictionary<string> = {
  uuid: "uuid",
  name: "name"
};

/**
 * This script is meant to run in the REPL:
 * > await bulkOrganisationImport('path-to.csv');
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const bulkOrganisationImport = withoutSqlLogs(async (csvPath: string, dryRun?: boolean) => {
  let rowCount = 0;
  const parseErrors: { row: number; message: string[] }[] = [];
  const rows: Row[] = [];

  try {
    await parseCsv(csvPath, async row => {
      rowCount++;
      try {
        const result = await parseRow(row);
        assert(
          rows.find(({ org: { name } }) => name === result.org.name) == null,
          `Duplicate organisation name within CSV: ${result.org.name}`
        );
        rows.push(result);
      } catch (error) {
        if (!(error instanceof AssertionError)) throw error;
        parseErrors.push({ row: rowCount + 1, message: [error.message] });
      }
    });

    if (parseErrors.length !== 0) {
      LOGGER.error(`Errors encountered during parsing:\n ${JSON.stringify(parseErrors, null, 2)}`);
      LOGGER.error("Processing aborted");
      return;
    }

    if (dryRun) {
      LOGGER.log(`Parsed data:\n ${JSON.stringify(rows, null, 2)}`);
      return;
    }

    const parts = csvPath.split(".");
    parts.pop();
    await persistRows(rows, timestampFileName(`${parts.join(".")} - result`));

    LOGGER.log(`Processed ${rowCount} rows from ${csvPath}`);
  } catch (err) {
    LOGGER.error(`Error processing CSV at ${csvPath} row ${rowCount + 1}: ${err.message}`);
  }
});

const decodeArray = (cell: string | null) => {
  if (cell == null) return [];
  return cell.split("|").filter(isNotNull);
};

const parseRow = async (row: Dictionary<string>) => {
  // hqStreet2, hqZipcode, currency, level0Proposed, level1Proposed, level0PastRestoration,
  // and level1PastRestoration are not required
  const name = assertNotNull(columnValue(row, "name"), "No name found");
  const type = assertMember(columnValue(row, "type"), VALID_TYPES, `Type not valid: ${columnValue(row, "type")}`);
  const hqStreet1 = assertNotNull(columnValue(row, "hqStreet1"), "No hqStreet1 found");
  const hqStreet2 = columnValue(row, "hqStreet2");
  const hqCity = assertNotNull(columnValue(row, "hqCity"), "No hqCity found");
  const hqState = assertNotNull(columnValue(row, "hqState"), "No hqState found");
  const hqZipcode = columnValue(row, "hqZipcode");
  const hqCountry = assertNotNull(columnValue(row, "hqCountry"), "No hqCountry found");
  const phone = assertNotNull(columnValue(row, "phone"), "No phone found");
  const currency = columnValue(row, "currency") ?? undefined;
  const countries = decodeArray(assertNotNull(columnValue(row, "countries"), "No countries found"));
  const fundingProgrammeUuid = assertNotNull(columnValue(row, "fundingProgrammeUuid"), "No fundingProgrammeUuid found");
  const level0Proposed = decodeArray(columnValue(row, "level0Proposed"));
  const level1Proposed = decodeArray(columnValue(row, "level1Proposed"));
  const level0PastRestoration = decodeArray(columnValue(row, "level0PastRestoration"));
  const level1PastRestoration = decodeArray(columnValue(row, "level1PastRestoration"));

  assert((await Organisation.count({ where: { name } })) === 0, `Organisation already exists: ${name}`);
  const fp = await FundingProgramme.findOne({
    where: { uuid: fundingProgrammeUuid },
    attributes: ["id"],
    include: [{ association: "stages", attributes: ["id"] }]
  });
  assertNotNull(fp, `Funding programme not found: ${fundingProgrammeUuid}`);
  assert((fp?.stages?.length ?? 0) > 0, `Funding programme has no stages: ${fundingProgrammeUuid}`);

  const org: CreationAttributes<Organisation> = {
    name,
    type,
    hqStreet1,
    hqStreet2,
    hqCity,
    hqState,
    hqZipcode,
    hqCountry,
    phone,
    currency,
    countries,
    level0PastRestoration,
    level1PastRestoration
  };
  return { org, fundingProgrammeUuid, level0Proposed, level1Proposed };
};

const persistRows = async (rows: Row[], resultFileName: string) => {
  LOGGER.log(`Creating ${rows.length} organisations`);
  const downloadUrl = await writeCsv(resultFileName, EXPORT_COLUMNS, async addRow => {
    for (const row of rows) {
      addRow(await createOrg(row));
    }
  });

  if (downloadUrl != null) {
    LOGGER.log(`Download URL for orgs result CSV: ${downloadUrl}`);
  }
};

const createOrg = async ({ org: orgCreationData, fundingProgrammeUuid, level0Proposed, level1Proposed }: Row) => {
  const org = await Organisation.create(orgCreationData);

  // Create a blank application for the indicated funding programme. Note: the application
  // updated_by and form submission user_id must be left blank because we don't have a user in this
  // context. The user import script that will be run after this one will add that data when the
  // first user is added to the org.
  const stage = (await Stage.findOne({
    where: { fundingProgrammeId: fundingProgrammeUuid },
    include: [{ association: "form", attributes: ["uuid"] }],
    order: [["order", "ASC"]]
  })) as Stage;
  const pitch = await ProjectPitch.create({
    organisationId: org.uuid,
    fundingProgrammeId: fundingProgrammeUuid,
    level0Proposed,
    level1Proposed
  });
  const application = await Application.create({
    organisationUuid: org.uuid,
    fundingProgrammeUuid: fundingProgrammeUuid
  });
  await FormSubmission.create({
    formId: stage.form?.uuid,
    stageUuid: stage.uuid,
    organisationUuid: org.uuid,
    projectPitchUuid: pitch.uuid,
    applicationId: application.id,
    answers: {}
  });

  return org;
};
