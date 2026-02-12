import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { EntityQueryDto } from "./entities/dto/entity-query.dto";
import {
  Audit,
  Form,
  FormQuestion,
  FormSection,
  FormSubmission,
  Framework,
  FundingProgramme,
  I18nItem,
  Organisation,
  Project,
  ProjectPitch,
  Tracking,
  TrackingEntry,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { Attributes, col, CreationAttributes, fn, literal, Op, where } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import ProgressBar from "progress";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { acceptMimeTypes, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { generateHashedKey } from "@transifex/native";
import { DateTime } from "luxon";
import { LinkedFile, RelationInputType } from "@terramatch-microservices/database/constants/linked-fields";
import { cloneDeep, Dictionary, flattenDeep, isEqual, isUndefined, omitBy, sumBy, uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { ORGANISATION_TYPES, OrganisationType } from "@terramatch-microservices/database/constants";
import { Model, ModelCtor } from "sequelize-typescript";
import { TrackingType } from "@terramatch-microservices/database/types/tracking";
import { laravelType } from "@terramatch-microservices/database/types/util";

bootstrapRepl("Entity Service", AppModule, {
  EntityQueryDto,

  // One off scripts for running in the REPL. Should be cleared out occasionally once they've been
  // run in all relevant environments. Note: it's a good idea to put the newest scripts at the top
  // so that the scripts are ordered from newest to oldest and it's easier to identify which
  // scripts are old enough to be removed.
  oneOff: {
    migrateRestorationData: withoutSqlLogs(async () => {
      await processRestorationModel("Organisations", Organisation, ORGS_RESTORATION);
      await processRestorationModel("Project Pitches", ProjectPitch, PITCHES_RESTORATION);
      await processRestorationModel("Projects", Project, PROJECTS_RESTORATION);
    }),

    // Sets the additionalProps.accept field on all file form questions to the mime types accepted for
    // that linked field. Matches the behavior in FormsService.getAdditionalProps()
    // https://gfw.atlassian.net/browse/TM-2411. May be removed after the RR release in November 2025
    syncFileAdditionalProps: withoutSqlLogs(async () => {
      const builder = new PaginatedQueryBuilder(FormQuestion, 100).where({
        inputType: "file",
        linkedFieldKey: { [Op.not]: null }
      });
      const bar = new ProgressBar("Processing file FormQuestions [:bar] :percent :etas", {
        width: 40,
        total: await builder.paginationTotal()
      });
      for await (const page of batchFindAll(builder)) {
        for (const question of page) {
          const config = question.linkedFieldKey == null ? undefined : getLinkedFieldConfig(question.linkedFieldKey);
          if (config != null) {
            question.additionalProps = {
              ...question.additionalProps,
              accept: acceptMimeTypes(config.model as MediaOwnerType, (config.field as LinkedFile).collection)
            };
            await question.save();
          }

          bar.tick();
        }
      }

      console.log("Finished synchronizing file form questions with the model media types.");
    }),

    updateFormFrameworkKeys: withoutSqlLogs(async () => {
      console.log("Updating Funding Programmes...");
      await FundingProgramme.update(
        { frameworkKey: "terrafund-landscapes" },
        { where: { frameworkKey: "landscapes" } }
      );

      console.log("Updating Forms...");
      await Form.update({ frameworkKey: "terrafund-landscapes" }, { where: { frameworkKey: "landscapes" } });
      await Form.update({ frameworkKey: null }, { where: { frameworkKey: { [Op.in]: ["test", "tfBusiness"] } } });

      console.log("Updating Reporting Frameworks...");
      for (const framework of await Framework.findAll()) {
        if (framework.slug !== framework.accessCode) await framework.update({ accessCode: framework.slug });
      }
    }),

    // In moving the "view entity with schema" pattern to v3, the embedded answer DTOs in
    // relation fields has become camel case. Update requests contain embedded data for these
    // field types and need a migration to adapt.
    updateCamelCaseAnswers: withoutSqlLogs(async () => {
      const processInputs = async (
        inputTypes: RelationInputType[],
        label: string,
        update: (questionUuids: string[], content: object) => void
      ) => {
        const uuids = (
          await FormQuestion.findAll({
            where: { inputType: { [Op.in]: inputTypes } },
            attributes: ["uuid"]
          })
        ).map(({ uuid }) => uuid);

        if (uuids.length === 0) {
          console.log(`No questions found for for ${label} answers.\n`);
          return;
        }

        const builder = new PaginatedQueryBuilder(UpdateRequest, 100).where(
          fn("JSON_CONTAINS_PATH", col("content"), literal("'one'"), ...uuids.map(uuid => literal(`'$.${uuid}'`)))
        );
        const bar = new ProgressBar(`Processing :total UpdateRequests for ${label} answers [:bar] :percent :etas`, {
          width: 40,
          total: await builder.paginationTotal()
        });
        let updated = 0;
        for await (const page of batchFindAll(builder)) {
          for (const updateRequest of page) {
            const content = cloneDeep(updateRequest.content) ?? {};
            update(uuids, content);
            if (!isEqual(content, updateRequest.content)) {
              updated++;
              await updateRequest.update({ content }, { silent: true });
            }

            bar.tick();
          }
        }
        console.log(`Updated ${updated} UpdateRequests for ${label} answers.\n`);
      };

      const demographicsInputTypes: RelationInputType[] = [
        "workdays",
        "restorationPartners",
        "jobs",
        "employees",
        "volunteers",
        "allBeneficiaries",
        "trainingBeneficiaries",
        "indirectBeneficiaries",
        "associates"
      ];
      await processInputs(demographicsInputTypes, "demographics", (questionUuids, content) => {
        for (const uuid of questionUuids) {
          if (content[uuid]?.[0]?.demographics != null) {
            // move the "demographics" member to "entries"
            const { demographics, ...rest } = content[uuid][0];
            content[uuid][0] = { entries: demographics, ...rest };
          }
        }
      });

      await processInputs(["disturbanceReportEntries"], "disturbance report entries", (questionUuids, content) => {
        for (const uuid of questionUuids) {
          if (content[uuid] != null) {
            content[uuid] = content[uuid].map(
              // remove the timestamps and camelCase input_type
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ({ input_type: inputType, created_at, updated_at, ...rest }) =>
                // omitting undefined keys is important for the isEqual check above
                omitBy(
                  {
                    inputType,
                    // On all of these, ...rest has to come last to keep the script idempotent.
                    ...rest
                  },
                  isUndefined
                )
            );
          }
        }
      });

      await processInputs(["financialIndicators"], "financial indicators", (questionUuids, content) => {
        for (const uuid of questionUuids) {
          if (content[uuid] != null) {
            content[uuid] = content[uuid].map(
              // remove org id and move financial_report_id, exchange_rate, start_month to the top level
              ({
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                organisation_id,
                financial_report_id: financialReportId,
                exchange_rate: exchangeRate,
                start_month: startMonth,
                ...rest
              }) =>
                omitBy(
                  {
                    financialReportId,
                    exchangeRate,
                    startMonth,
                    ...rest
                  },
                  isUndefined
                )
            );
          }
        }
      });

      await processInputs(["seedings"], "seedings", (questionUuids, content) => {
        for (const uuid of questionUuids) {
          if (content[uuid] != null) {
            // move weight of sample and seeds in sample to camel case
            content[uuid] = content[uuid].map(
              ({ weight_of_sample: weightOfSample, seeds_in_sample: seedsInSample, ...rest }) =>
                omitBy(
                  {
                    weightOfSample,
                    seedsInSample,
                    ...rest
                  },
                  isUndefined
                )
            );
          }
        }
      });

      await processInputs(["treeSpecies"], "treeSpecies", (questionUuids, content) => {
        for (const uuid of questionUuids) {
          if (content[uuid] != null) {
            content[uuid] = content[uuid].map(
              ({ taxon_id: taxonId, report_amount: reportAmount, is_new_species: isNewSpecies, ...rest }) =>
                omitBy(
                  {
                    taxonId,
                    reportAmount,
                    isNewSpecies,
                    ...rest
                  },
                  isUndefined
                )
            );
          }
        }
      });
    }),

    updateConditionalLinkedFields: withoutSqlLogs(async () => {
      // There was one case of a conditional incorrectly used as a linked field in the configs.
      // Due to a quirk in the PHP logic, it wasn't actually trying to save as a field on the model,
      // but we explicitly disallow this in the FE code, so we need to remove the linked field key
      // from those question rows in the DB.
      console.log("Updating form questions for org-carbon-credits...");
      const [updated] = await FormQuestion.update(
        { linkedFieldKey: null },
        { where: { linkedFieldKey: "org-carbon-credits" } }
      );
      console.log(`Updated rows: ${updated}`);

      // There was a whole set of linked fields in project report that were attempting to write
      // to properties that don't exist on the model. Thankfully, the only questions that hadn't
      // already been deleted and were referencing these fields were children of parent questions
      // that _have_ been deleted, so this is not an active problem in the production forms.
      console.log("Updating form questions for ethnic project report fields...");
      const deleted = await FormQuestion.destroy({
        where: {
          linkedFieldKey: [
            "pro-rep-ind-1",
            "pro-rep-ind-2",
            "pro-rep-ind-3",
            "pro-rep-ind-4",
            "pro-rep-ind-5",
            "pro-rep-other-1",
            "pro-rep-other-2",
            "pro-rep-other-3",
            "pro-rep-other-4",
            "pro-rep-other-5"
          ]
        }
      });
      console.log(`Deleted rows: ${deleted}`);
    }),

    // The PHP BE was storing the answer to _every_ question on the form_submissions `answers`
    // column even though most conditional answers sync to the associated project pitch or
    // organisation, and are pulled from the associated table when the submission DTO is rendered.
    // In order to clear out a bunch of unnecessary data, let's update those records now.
    updateFormSubmissionAnswers: withoutSqlLogs(async () => {
      const builder = new PaginatedQueryBuilder(FormSubmission, 100);
      const bar = new ProgressBar(`Processing :total FormSubmissions [:bar] :percent :etas`, {
        width: 40,
        total: await builder.paginationTotal()
      });
      for await (const page of batchFindAll(builder)) {
        const formUuids = uniq(page.map(submission => submission.formId)).filter(isNotNull);
        const sections = await FormSection.findAll({ where: { formId: formUuids } });
        const questions = await FormQuestion.findAll({ where: { formSectionId: sections.map(({ id }) => id) } });
        const answerQuestionUuidsByFormUuid = questions.reduce((questions, { uuid, linkedFieldKey, formSectionId }) => {
          if (linkedFieldKey != null) return questions;

          const formId = sections.find(({ id }) => id === formSectionId)?.formId;
          if (formId == null) return questions;

          questions[formId] ??= [];
          questions[formId].push(uuid);
          return questions;
        }, {} as Dictionary<string[]>);

        for (const submission of page) {
          if (submission.formId == null) {
            bar.tick();
            continue;
          }

          const questionUuids = answerQuestionUuidsByFormUuid[submission.formId] ?? [];
          const answers = questionUuids.reduce((answers, uuid) => {
            const answer = submission.answers?.[uuid];
            if (answer == null) return answers;

            return { ...answers, [uuid]: answer };
          }, {} as Dictionary<unknown>);

          // silent to avoid setting the updatedAt timestamp
          await submission.update({ answers }, { silent: true });
          bar.tick();
        }
      }

      console.log("Finished updating FormSubmissions...");
    }),

    updateHashOni18nItems: withoutSqlLogs(async () => {
      const builder = new PaginatedQueryBuilder(I18nItem, 100).where({ hash: null });
      const bar = new ProgressBar("Processing I18nItems [:bar] :percent :etas", {
        width: 40,
        total: await builder.paginationTotal()
      });
      for await (const page of batchFindAll(builder)) {
        for (const i18nItem of page) {
          if (i18nItem.shortValue == null && i18nItem.longValue == null) continue;
          i18nItem.hash = generateHashedKey(i18nItem.shortValue ?? i18nItem.longValue ?? "");
          i18nItem.status = "draft";
          await i18nItem.save();
          bar.tick();
        }
      }

      console.log("Finished updating hashes on I18nItems.");
      console.log(`Updated ${bar.total} I18nItems.`);
    }),

    cleanAudits: async () => {
      const deletedAuditCount = await Audit.destroy({
        where: {
          [Op.and]: [
            where(col("old_values"), "=", col("new_values")),
            { auditableType: { [Op.ne]: FormSubmission.LARAVEL_TYPE } },
            { createdAt: { [Op.gt]: DateTime.fromObject({ year: 2024, month: 9, day: 1 }).toJSDate() } }
          ]
        }
      });
      console.log(`Deleted ${deletedAuditCount} audits`);
    },

    fixFundingProgrammeOrgTypes: withoutSqlLogs(async () => {
      const fundingProgrammes = await FundingProgramme.findAll();
      for (const programme of fundingProgrammes) {
        const orgTypes = [...(programme.organisationTypes ?? [])];
        for (let ii = 0; ii < orgTypes.length; ii++) {
          const orgType = orgTypes[ii];
          if (!ORGANISATION_TYPES.includes(orgType)) {
            let replacement: OrganisationType | null = null;
            if (orgType.includes("non-profit")) {
              replacement = "non-profit-organization";
            } else if (orgType.includes("for-profit")) {
              replacement = "for-profit-organization";
            }

            if (replacement != null) {
              console.log(`Replacing ${orgType} with ${replacement} in funding programme ${programme.id}...`);
              orgTypes[ii] = replacement;
            } else {
              console.error(`Unknown funding programme organisation type ${orgType} in ${programme.id}...`);
              orgTypes.splice(ii, 1);
              ii--;
            }
          }
        }

        if (!isEqual(orgTypes, programme.organisationTypes)) {
          await programme.update({ organisationTypes: orgTypes });
        }
      }
    })
  }
});

type RestorationMapping<M extends Model> = {
  attributes: (keyof Attributes<M>)[];
  type: TrackingType;
  collection: string;
  entries: {
    type: string;
    subtype: string;
    // If undefined is returned, the entry is not created. If no entries are created for a given
    // tracking, the tracking itself is not created.
    amount: (model: M, entries: CreationAttributes<TrackingEntry>[]) => number | undefined;
  }[];
};

const columnValue =
  <M extends Model>(column: keyof Attributes<M>) =>
  (model: M) => {
    if (model[column] == null) return undefined;
    const value = model[column] as number;
    return value <= 0 ? undefined : value;
  };

const entryTypeTotal = (type: string, entries: CreationAttributes<TrackingEntry>[]) => {
  const filtered = entries.filter(entry => entry.type === type);
  return filtered.length === 0 ? undefined : sumBy(filtered, "amount");
};

const ORGS_RESTORATION: RestorationMapping<Organisation>[] = [
  {
    attributes: ["haRestored3Year", "haRestoredTotal"],
    type: "hectares-historical",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("haRestored3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ haRestoredTotal, haRestored3Year }) => {
          if (haRestoredTotal == null && haRestored3Year == null) return undefined;
          const amount = Math.max(0, haRestoredTotal ?? 0) - Math.max(0, haRestored3Year ?? 0);
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  },
  {
    attributes: ["treesNaturallyRegenerated3Year", "treesNaturallyRegeneratedTotal"],
    type: "trees-historical",
    collection: "regenerated",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("treesNaturallyRegenerated3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ treesNaturallyRegeneratedTotal, treesNaturallyRegenerated3Year }) => {
          if (treesNaturallyRegeneratedTotal == null && treesNaturallyRegenerated3Year == null) return undefined;
          const amount =
            Math.max(0, treesNaturallyRegeneratedTotal ?? 0) - Math.max(0, treesNaturallyRegenerated3Year ?? 0);
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  },
  {
    attributes: ["treesGrown3Year", "treesGrownTotal"],
    type: "trees-historical",
    collection: "grown",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("treesGrown3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ treesGrownTotal, treesGrown3Year }) => {
          if (treesGrownTotal == null && treesGrown3Year == null) return undefined;
          const amount = Math.max(0, treesGrownTotal ?? 0) - Math.max(0, treesGrown3Year ?? 0);
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  }
];

const PITCHES_RESTORATION: RestorationMapping<ProjectPitch>[] = [
  {
    attributes: [
      "totalTreesFirstYr",
      "totalTreeSecondYr",
      "goalTreesRestoredAnr",
      "goalTreesRestoredDirectSeeding",
      "goalTreesRestoredPlanting",
      "totalTrees"
    ],
    type: "trees-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "1-year",
        amount: columnValue("totalTreesFirstYr")
      },
      {
        type: "years",
        subtype: "2-year",
        amount: columnValue("totalTreeSecondYr")
      },
      {
        type: "strategy",
        subtype: "anr",
        amount: columnValue("goalTreesRestoredAnr")
      },
      {
        type: "strategy",
        subtype: "direct-seeding",
        amount: columnValue("goalTreesRestoredDirectSeeding")
      },
      {
        type: "strategy",
        subtype: "planting",
        amount: columnValue("goalTreesRestoredPlanting")
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: ({ totalTrees }, entries) => {
          // unknown years haven't been calculated yet, so make sure we at least reach the totalTrees value.
          const years = Math.max(totalTrees ?? 0, entryTypeTotal("years", entries) ?? 0);
          const strategy = entryTypeTotal("strategy", entries) ?? 0;
          return strategy >= years ? undefined : years - strategy;
        }
      },
      {
        type: "years",
        subtype: "unknown",
        amount: (_, entries) => {
          const years = entryTypeTotal("years", entries) ?? 0;
          const strategy = entryTypeTotal("strategy", entries) ?? 0;
          // the totalTrees column was taken into account for the strategy total, so we can use
          // it as the canonical balanced sum.
          return strategy > years ? strategy - years : undefined;
        }
      }
    ]
  },
  {
    attributes: ["hectaresFirstYr", "totalHectares"],
    type: "hectares-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "1-year",
        amount: columnValue("hectaresFirstYr")
      },
      {
        type: "years",
        subtype: "unknown",
        amount: ({ totalHectares }, entries) => {
          const years = entryTypeTotal("years", entries) ?? 0;
          return totalHectares == null || totalHectares <= years ? undefined : totalHectares - years;
        }
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      },
      {
        type: "land-use",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      }
    ]
  }
];

const PROJECTS_RESTORATION: RestorationMapping<Project>[] = [
  {
    attributes: [
      "goalTreesRestoredAnr",
      "goalTreesRestoredDirectSeeding",
      "goalTreesRestoredPlanting",
      "treesGrownGoal"
    ],
    type: "trees-goal",
    collection: "all",
    entries: [
      {
        type: "strategy",
        subtype: "anr",
        amount: columnValue("goalTreesRestoredAnr")
      },
      {
        type: "strategy",
        subtype: "direct-seeding",
        amount: columnValue("goalTreesRestoredDirectSeeding")
      },
      {
        type: "strategy",
        subtype: "planting",
        amount: columnValue("goalTreesRestoredPlanting")
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: ({ treesGrownGoal }, entries) => {
          const strategy = entryTypeTotal("strategy", entries) ?? 0;
          return treesGrownGoal == null || treesGrownGoal <= strategy ? undefined : treesGrownGoal - strategy;
        }
      },
      {
        type: "years",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("strategy", entries)
      }
    ]
  },
  {
    attributes: ["totalHectaresRestoredGoal"],
    type: "hectares-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "unknown",
        amount: columnValue("totalHectaresRestoredGoal")
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      },
      {
        type: "land-use",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      }
    ]
  }
];

// maximum value of an int(11) signed column. Any value larger than this is clearly bogus testing
// data and may be ignored.
const MAX_AMOUNT = 2147483647;
const processRestorationMapping = async <M extends Model>(model: M, mappings: RestorationMapping<M>[]) => {
  for (const mapping of mappings) {
    const entries: CreationAttributes<TrackingEntry>[] = [];
    for (const entry of mapping.entries) {
      const amount = entry.amount(model, entries);
      if (amount != null && amount < MAX_AMOUNT) {
        // the real tracking ID will be filled in below before the entries are created.
        entries.push({ trackingId: -1, type: entry.type, subtype: entry.subtype, amount });
      }
    }
    if (entries.length > 0) {
      const tracking = await Tracking.create({
        domain: "restoration",
        type: mapping.type,
        collection: mapping.collection,
        trackableType: laravelType(model),
        trackableId: model.id
      });
      for (const entry of entries) entry.trackingId = tracking.id;
      await TrackingEntry.bulkCreate(entries);
    }
  }
};

const processRestorationModel = async <M extends Model>(
  label: string,
  ctor: ModelCtor<M>,
  mappings: RestorationMapping<M>[]
) => {
  const builder = new PaginatedQueryBuilder(ctor, 100);
  builder.attributes(uniq(flattenDeep(["id", mappings.map(({ attributes }) => attributes)])));
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} ${label} [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const instance of page) {
      await processRestorationMapping(instance, mappings);
      bar.tick();
    }
  }
};
