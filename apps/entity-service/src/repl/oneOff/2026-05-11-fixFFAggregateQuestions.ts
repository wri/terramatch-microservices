import ProgressBar from "progress";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FindOptions, literal, Op } from "sequelize";
import {
  Form,
  FormQuestion,
  FormSubmission,
  Project,
  ProjectPitch,
  Tracking,
  TrackingEntry
} from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { groupBy } from "lodash";

// This is a private interface in v6. In v7, this is made available publicly available and when that
// upgrade is done, our SubqueryBuilder will become much simpler and more robust by using the query
// generator. In the meantime, this is a clean-ish way to generate a LIKE subquery
type QueryGenerator = { selectQuery: (tableName: string, options: FindOptions) => string };

const LINKED_KEY_MAPPINGS = {
  "pro-pit-beneficiaries-count": "pro-pit-aggregate-beneficiaries-count",
  "pro-pit-indirect-beneficiaries-count": "pro-pit-aggregate-indirect-beneficiaries-count"
};

export const fixFFAggregateQuestions = withoutSqlLogs(async () => {
  console.log("Updating form questions for Funda Flora applications...");
  const generator = (Form as unknown as { queryGenerator: QueryGenerator }).queryGenerator;
  const ffForms = literal(
    generator
      .selectQuery("forms", { where: { title: { [Op.like]: "Fundo Flora%" } }, attributes: ["uuid"] })
      .replace(";", "")
  );
  for (const [oldKey, newKey] of Object.entries(LINKED_KEY_MAPPINGS)) {
    const [updated] = await FormQuestion.forForm(ffForms).update(
      { linkedFieldKey: newKey },
      { where: { linkedFieldKey: oldKey } }
    );

    console.log(`Updated ${updated} questions moving ${oldKey} to ${newKey}.`);
  }

  await processBuilder(
    "pitches",
    new PaginatedQueryBuilder(ProjectPitch, 10)
      .where({
        uuid: { [Op.in]: Subquery.select(FormSubmission, "projectPitchUuid").in("formId", ffForms).literal }
      })
      .attributes(["id"])
  );
  await processBuilder(
    "projects",
    new PaginatedQueryBuilder(Project, 10).where({ frameworkKey: "fundo-flora-1" }).attributes(["id"])
  );
});

const processBuilder = async (label: string, builder: PaginatedQueryBuilder<ProjectPitch | Project>) => {
  const total = await builder.paginationTotal();
  const projectBar = new ProgressBar(`Processing ${total} FF ${label} [:bar] :percent :etas`, {
    width: 40,
    total: total
  });
  for await (const page of batchFindAll(builder)) {
    for (const model of page) {
      await processModel(model);
      projectBar.tick();
    }
  }
};

const processModel = async (model: Project | ProjectPitch) => {
  const trackings = await Tracking.for(model)
    .domain("demographics")
    .type(["all-beneficiaries", "indirect-beneficiaries"])
    .collection(["all", "aggregate"])
    .findAll();

  const allBeneficiaries = groupBy(
    trackings.filter(({ type }) => type === "all-beneficiaries"),
    "collection"
  );
  // if they already have an aggregate value, skip
  if ((allBeneficiaries.all ?? []).length > 0 && (allBeneficiaries.aggregate ?? []).length === 0) {
    await processTracking(allBeneficiaries.all[0]);
  }

  const indirectBeneficiaries = groupBy(
    trackings.filter(({ type }) => type === "indirect-beneficiaries"),
    "collection"
  );
  if ((indirectBeneficiaries.all ?? []).length > 0 && (indirectBeneficiaries.aggregate ?? []).length === 0) {
    await processTracking(indirectBeneficiaries.all[0]);
  }
};

const processTracking = async (original: Tracking) => {
  const entries = await TrackingEntry.tracking(original.id).findAll();
  if (entries.length === 2 && entries.find(({ subtype }) => subtype !== "unknown") == null) {
    // This is already acting like an aggregate tracking, simply update the collection.
    await original.update({ collection: "aggregate" });
  } else {
    // Find the gender total and then create a new aggregate tracking
    const amount = entries.filter(({ type }) => type === "gender").reduce((total, { amount }) => total + amount, 0);
    const tracking = await Tracking.create({
      trackableType: original.trackableType,
      trackableId: original.trackableId,
      domain: original.domain,
      type: original.type,
      collection: "aggregate",
      hidden: original.hidden
    });
    await TrackingEntry.bulkCreate(
      ["gender", "age"].map(type => ({ trackingId: tracking.id, type, subtype: "unknown", amount }))
    );
  }
};
