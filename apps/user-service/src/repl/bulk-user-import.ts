import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import {
  assert,
  AssertionError,
  assertMember,
  assertNotNull
} from "@terramatch-microservices/common/util/repl/assertions";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Dictionary } from "lodash";
import { CreationAttributes } from "sequelize";
import {
  Application,
  ModelHasRole,
  Organisation,
  PasswordReset,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { VALID_LOCALES, ValidLocale } from "@terramatch-microservices/database/constants/locale";
import crypto from "node:crypto";
import { BulkUserCreationEmail } from "@terramatch-microservices/common/email/bulk-user-creation.email";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { EmailService } from "@terramatch-microservices/common/email/email.service";

const LOGGER = new TMLogger("Bulk User Import");

type Row = {
  user: CreationAttributes<User>;
  orgUuid: string;
  roleId: number;
};

/**
 * This script is meant to run in the REPL:
 * > await bulkOrganisationImport('path-to.csv');
 *
 * In local dev, the file path is expected to be on the local machine. In AWS, the file path should
 * be in the wri-tm-repl S3 bucket.
 */
export const bulkUserImport = withoutSqlLogs(async (csvPath: string, dryRun?: boolean) => {
  let rowCount = 0;
  const parseErrors: { row: number; message: string[] }[] = [];
  const rows: Row[] = [];

  try {
    await parseCsv(csvPath, async row => {
      rowCount++;
      try {
        const result = await parseRow(row);
        assert(
          rows.find(({ user: { emailAddress } }) => emailAddress === result.user.emailAddress) == null,
          `Duplication email address within the CSV: ${result.user.emailAddress}`
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

    await persistRows(rows);

    LOGGER.log(`Processed ${rowCount} rows from ${csvPath}`);
  } catch (err) {
    LOGGER.error(`Error processing CSV at ${csvPath} row ${rowCount + 1}: ${err.message}`);
  }
});

const parseRow = async (row: Dictionary<string>) => {
  const orgUuid = assertNotNull(columnValue(row, "organisationUuid"), "No name found");
  const firstName = assertNotNull(columnValue(row, "firstName"), "No firstName found");
  const lastName = assertNotNull(columnValue(row, "lastName"), "No lastName found");
  const emailAddress = assertNotNull(columnValue(row, "emailAddress"), "No email found");
  const roleName = assertNotNull(columnValue(row, "role"), "No role found");
  const locale = assertMember(columnValue(row, "locale"), VALID_LOCALES, "No valid locale found") as ValidLocale;

  assert((await User.count({ where: { emailAddress } })) === 0, `User already exists: ${emailAddress}`);

  const org = assertNotNull(
    await Organisation.findOne({ where: { uuid: orgUuid }, attributes: ["id"] }),
    `Organisation not found: ${orgUuid}`
  );
  const role = assertNotNull(
    await Role.findOne({ where: { name: roleName }, attributes: ["id"] }),
    `Role not found: ${roleName}`
  );

  const user: CreationAttributes<User> = { emailAddress, firstName, lastName, locale, organisationId: org.id };
  return { user, orgUuid, roleId: role.id };
};

const persistRows = async (rows: Row[]) => {
  LOGGER.log(`Creating ${rows.length} users`);
  for (const { user: userCreationData, orgUuid, roleId } of rows) {
    const user = await User.create(userCreationData);
    await ModelHasRole.create({ roleId, modelType: User.LARAVEL_TYPE, modelId: user.id });

    // If the org hasn't yet had a user attached to its applications and form submissions, attach this user to them.
    const applications = await Application.findAll({
      where: { organisationUuid: orgUuid },
      attributes: ["id", "updatedBy"],
      include: [
        { association: "formSubmissions", attributes: ["id", "userId"] },
        { association: "fundingProgramme", attributes: ["name"] }
      ]
    });
    for (const application of applications) {
      if (application.updatedBy == null) await application.update({ updatedBy: user.id });

      for (const submission of application.formSubmissions ?? []) {
        if (submission.userId == null) await submission.update({ userId: user.uuid });
      }
    }

    // Create a password reset and send the email
    const token = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({ userId: user.id, token });
    await new BulkUserCreationEmail(token, applications[0]?.fundingProgrammeName ?? "", user).send(
      getService(EmailService)
    );
  }
};
