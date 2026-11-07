import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  AboutSection,
  DisturbanceReport,
  FinancialReport,
  Form,
  Framework,
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
import { ENTERPRISES, FRAMEWORK_NAMES, FrameworkKey, FUNDO_FLORA } from "@terramatch-microservices/database/constants";
import { Transaction, WhereOptions } from "sequelize";

const RENAMES: { from: string; to: FrameworkKey }[] = [
  { from: "enterprises", to: ENTERPRISES },
  { from: "fundo-flora-1", to: FUNDO_FLORA }
];

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
  FundingProgramme,
  Form,
  PolygonAttributeDefinition
];

/**
 * TM-3999: Renames the enterprises framework to terrafund-enterprises, and fundo-flora-1 to
 * fundo-flora (display name "Fundo Flora").
 *
 * Updates the framework row (slug, access code, name), every framework_key column (including
 * soft deleted rows), about section framework lists and scheduled job definitions. framework_user
 * rows reference the framework id, so they don't need to change.
 *
 * Requires migration 202611041200-widen-framework-key-columns.
 *
 * Run in entity-service REPL:
 *   await oneOff.renameFrameworks()
 *
 * Safe to re-run.
 */
export const renameFrameworks = withoutSqlLogs(async () => {
  await Framework.sequelize?.transaction(async transaction => {
    for (const { from, to } of RENAMES) {
      await renameFramework(from, to, transaction);
    }
  });
});

async function renameFramework(from: string, to: FrameworkKey, transaction: Transaction) {
  // The old key is no longer a valid FrameworkKey value, so filters on it need a looser type.
  const oldKeyWhere = { frameworkKey: from } as WhereOptions;

  const [frameworks] = await Framework.update(
    { slug: to, accessCode: to, name: FRAMEWORK_NAMES[to] },
    { where: { slug: from } as WhereOptions, transaction }
  );
  console.log(`[${from} -> ${to}] Framework: ${frameworks} rows renamed`);

  for (const model of REKEYED_MODELS) {
    const [count] = await (model as typeof Project).update(
      { frameworkKey: to },
      { where: oldKeyWhere, paranoid: false, silent: true, transaction }
    );
    console.log(`[${from} -> ${to}] ${model.name}: ${count} rows re-keyed`);
  }

  const aboutSections = await AboutSection.findAll({ attributes: ["id", "frameworks"], transaction });
  let sections = 0;
  for (const section of aboutSections) {
    const keys = section.frameworks as string[] | null;
    if (keys == null || !keys.includes(from)) continue;

    section.frameworks = keys.map(key => (key === from ? to : key)) as FrameworkKey[];
    await section.save({ silent: true, transaction });
    sections++;
  }
  console.log(`[${from} -> ${to}] AboutSection: ${sections} rows updated`);

  const jobs = await ScheduledJob.findAll({ where: { "taskDefinition.frameworkKey": from }, transaction });
  for (const job of jobs) {
    job.taskDefinition = { ...job.taskDefinition, frameworkKey: to };
    await job.save({ transaction });
  }
  console.log(`[${from} -> ${to}] ScheduledJob: ${jobs.length} rows updated`);
}
