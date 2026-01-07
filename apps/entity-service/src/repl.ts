import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { EntityQueryDto } from "./entities/dto/entity-query.dto";
import {
  Audit,
  Form,
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormSubmission,
  Framework,
  FundingProgramme,
  FundingType,
  I18nItem,
  Nursery,
  Organisation,
  Project,
  ProjectPitch,
  Site
} from "@terramatch-microservices/database/entities";
import { col, Op, where } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import ProgressBar from "progress";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { acceptMimeTypes, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { generateHashedKey } from "@transifex/native";
import { DateTime } from "luxon";

bootstrapRepl("Entity Service", AppModule, {
  EntityQueryDto,

  // One off scripts for running in the REPL. Should be cleared out occasionally once they've been
  // run in all relevant environments.
  oneOff: {
    // Sets the additionalProps.accept field on all file form questions to the mime types accepted for
    // that linked field. Matches the behavior in FormsService.getAdditionalProps()
    // https://gfw.atlassian.net/browse/TM-2411. May be removed after the RR release in November 2025
    syncFileAdditionalProps: async () => {
      await withoutSqlLogs(async () => {
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
                accept: acceptMimeTypes(config.model as MediaOwnerType, config.field.property)
              };
              await question.save();
            }

            bar.tick();
          }
        }

        console.log("Finished synchronizing file form questions with the model media types.");
      });
    },

    updateFormFrameworkKeys: async () => {
      await withoutSqlLogs(async () => {
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
      });
    },

    updateHashOni18nItems: async () => {
      await withoutSqlLogs(async () => {
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
      });
    },
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

    alignSlugOptions: async () => {
      await withoutSqlLogs(async () => {
        console.log("Starting slug alignment migration...\n");

        console.log("1. Updating form_option_list_options slugs...");
        const optionListUpdates = [
          { listKey: "organisation-type", oldSlug: "government", newSlug: "government-agency" },
          { listKey: "land-tenures", oldSlug: "common-land", newSlug: "communal-land" },
          { listKey: "land-tenures", oldSlug: "communal", newSlug: "communal-land" },
          { listKey: "land-tenures", oldSlug: "community-lands", newSlug: "communal-land" },
          { listKey: "land-tenures", oldSlug: "indigenous", newSlug: "indigenous-land" },
          { listKey: "land-tenures", oldSlug: "national_protected_area", newSlug: "national-protected-area" },
          { listKey: "land-tenures", oldSlug: "other", newSlug: "other-land" },
          { listKey: "land-tenures", oldSlug: "private", newSlug: "private-land" },
          { listKey: "land-tenures", oldSlug: "public", newSlug: "public-land" },
          { listKey: "land-tenures-brazil", oldSlug: "common-land", newSlug: "communal-land" },
          { listKey: "land-tenures-brazil", oldSlug: "communal", newSlug: "communal-land" },
          { listKey: "land-tenures-brazil", oldSlug: "indigenous", newSlug: "indigenous-land" },
          { listKey: "land-tenures-brazil", oldSlug: "indigenous-lands", newSlug: "indigenous-land" },
          { listKey: "land-tenures-brazil", oldSlug: "national_protected_area", newSlug: "national-protected-area" },
          { listKey: "land-tenures-brazil", oldSlug: "other", newSlug: "other-land" },
          { listKey: "land-tenures-brazil", oldSlug: "private", newSlug: "private-land" },
          { listKey: "land-tenures-brazil", oldSlug: "private-lands", newSlug: "private-land" },
          { listKey: "land-tenures-brazil", oldSlug: "public", newSlug: "public-land" },
          { listKey: "siting-strategies", oldSlug: "concentred", newSlug: "concentrated" },
          { listKey: "nursery-type", oldSlug: "manageing", newSlug: "managing" },
          {
            listKey: "land-use-systems",
            oldSlug: "riparian-area-wetland-or-mangrove",
            newSlug: "riparian-area-or-wetland"
          }
        ];

        const uniqueListKeys = [...new Set(optionListUpdates.map(update => update.listKey))];
        const formOptionLists = await FormOptionList.findAll({
          where: { key: { [Op.in]: uniqueListKeys } }
        });
        const listMap = new Map(formOptionLists.map(list => [list.key, list]));

        let optionListUpdated = 0;
        for (const update of optionListUpdates) {
          const list = listMap.get(update.listKey);
          if (list != null) {
            const updated = await FormOptionListOption.update(
              { slug: update.newSlug },
              { where: { formOptionListId: list.id, slug: update.oldSlug } }
            );
            optionListUpdated += updated[0];
          }
        }
        console.log(`   Updated ${optionListUpdated} form_option_list_options\n`);

        console.log("2. Updating v2_projects.land_tenure_project_area...");
        const projectBuilder = new PaginatedQueryBuilder(Project, 100).where({
          landTenureProjectArea: { [Op.ne]: null }
        });
        const projectBar = new ProgressBar("Processing Projects [:bar] :percent :etas", {
          width: 40,
          total: await projectBuilder.paginationTotal()
        });
        let projectsUpdated = 0;
        for await (const page of batchFindAll(projectBuilder)) {
          for (const project of page) {
            if (project.landTenureProjectArea == null) continue;
            let updated = false;
            const newArray = project.landTenureProjectArea.map((slug: string) => {
              const mappings: Record<string, string> = {
                "common-land": "communal-land",
                communal: "communal-land",
                "community-lands": "communal-land",
                indigenous: "indigenous-land",
                national_protected_area: "national-protected-area",
                other: "other-land",
                private: "private-land",
                public: "public-land"
              };
              if (mappings[slug] != null && mappings[slug] !== slug) {
                updated = true;
                return mappings[slug];
              }
              return slug;
            });
            if (updated) {
              project.landTenureProjectArea = newArray;
              await project.save();
              projectsUpdated++;
            }
            projectBar.tick();
          }
        }
        console.log(`   Updated ${projectsUpdated} projects\n`);

        console.log("3. Updating project_pitches.land_tenure_proj_area...");
        const pitchBuilder = new PaginatedQueryBuilder(ProjectPitch, 100).where({
          landTenureProjArea: { [Op.ne]: null }
        });
        const pitchBar = new ProgressBar("Processing Project Pitches [:bar] :percent :etas", {
          width: 40,
          total: await pitchBuilder.paginationTotal()
        });
        let pitchesUpdated = 0;
        for await (const page of batchFindAll(pitchBuilder)) {
          for (const pitch of page) {
            if (pitch.landTenureProjArea == null) continue;
            let updated = false;
            const newArray = pitch.landTenureProjArea.map((slug: string) => {
              const mappings: Record<string, string> = {
                "common-land": "communal-land",
                communal: "communal-land",
                indigenous: "indigenous-land",
                "indigenous-lands": "indigenous-land",
                national_protected_area: "national-protected-area",
                other: "other-land",
                private: "private-land",
                "private-lands": "private-land",
                public: "public-land",
                "public-land": "public-land"
              };
              if (mappings[slug] != null && mappings[slug] !== slug) {
                updated = true;
                return mappings[slug];
              }
              return slug;
            });
            if (updated) {
              pitch.landTenureProjArea = newArray;
              await pitch.save();
              pitchesUpdated++;
            }
            pitchBar.tick();
          }
        }
        console.log(`   Updated ${pitchesUpdated} project pitches\n`);

        console.log("4. Updating project_pitches.land_use_types...");
        const landUseBuilder = new PaginatedQueryBuilder(ProjectPitch, 100).where({
          landUseTypes: { [Op.ne]: null }
        });
        const landUseBar = new ProgressBar("Processing Land Use Types [:bar] :percent :etas", {
          width: 40,
          total: await landUseBuilder.paginationTotal()
        });
        let landUseUpdated = 0;
        for await (const page of batchFindAll(landUseBuilder)) {
          for (const pitch of page) {
            if (pitch.landUseTypes == null) continue;
            let updated = false;
            const newArray = pitch.landUseTypes.map((slug: string) => {
              if (slug === "riparian-area-wetland-or-mangrove") {
                updated = true;
                return "riparian-area-or-wetland";
              }
              return slug;
            });
            if (updated) {
              pitch.landUseTypes = newArray;
              await pitch.save();
              landUseUpdated++;
            }
            landUseBar.tick();
          }
        }
        console.log(`   Updated ${landUseUpdated} project pitches (land_use_types)\n`);

        console.log("5. Updating v2_sites.land_tenures...");
        const siteLandTenureBuilder = new PaginatedQueryBuilder(Site, 100).where({
          landTenures: { [Op.ne]: null }
        });
        const siteLandTenureBar = new ProgressBar("Processing Site Land Tenures [:bar] :percent :etas", {
          width: 40,
          total: await siteLandTenureBuilder.paginationTotal()
        });
        let siteLandTenureUpdated = 0;
        for await (const page of batchFindAll(siteLandTenureBuilder)) {
          for (const site of page) {
            if (site.landTenures == null) continue;
            let updated = false;
            const newArray = site.landTenures.map((slug: string) => {
              const mappings: Record<string, string> = {
                communal: "communal-land",
                "community-lands": "communal-land",
                national_protected_area: "national-protected-area"
              };
              if (mappings[slug] != null && mappings[slug] !== slug) {
                updated = true;
                return mappings[slug];
              }
              return slug;
            });
            if (updated) {
              site.landTenures = newArray;
              await site.save();
              siteLandTenureUpdated++;
            }
            siteLandTenureBar.tick();
          }
        }
        console.log(`   Updated ${siteLandTenureUpdated} sites (land_tenures)\n`);

        console.log("6. Updating v2_sites.siting_strategy...");
        const sitingStrategyUpdated = await Site.update(
          { sitingStrategy: "concentrated" },
          { where: { sitingStrategy: "concentred" } }
        );
        console.log(`   Updated ${sitingStrategyUpdated[0]} sites (siting_strategy)\n`);

        console.log("7. Updating v2_nurseries.type...");
        const nurseryTypeUpdated = await Nursery.update({ type: "managing" }, { where: { type: "manageing" } });
        console.log(`   Updated ${nurseryTypeUpdated[0]} nurseries (type)\n`);

        console.log("8. Updating organisations.type...");
        const orgTypeUpdated = await Organisation.update(
          { type: "government-agency" },
          { where: { type: "government" } }
        );
        console.log(`   Updated ${orgTypeUpdated[0]} organisations (type)\n`);

        console.log("9. Updating v2_funding_types.type...");
        const fundingTypeUpdates = [
          { old: "private_grant_from_foundation", new: "private-grant-from-foundation" },
          { old: "equity_from_private_investor", new: "equity-from-private-investor" }
        ];
        let fundingTypesUpdated = 0;
        for (const update of fundingTypeUpdates) {
          const updated = await FundingType.update({ type: update.new }, { where: { type: update.old } });
          fundingTypesUpdated += updated[0];
        }
        console.log(`   Updated ${fundingTypesUpdated} funding types\n`);

        console.log("✓ Slug alignment migration completed successfully!");
        console.log("\nNote: Descriptive text entries in project_pitches.land_tenure_proj_area");
        console.log("should be reviewed manually as they don't map to standardized slugs.");
      });
    }
  }
});
