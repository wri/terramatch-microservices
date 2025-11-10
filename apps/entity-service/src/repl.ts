import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { EntityQueryDto } from "./entities/dto/entity-query.dto";
import { Form, FormQuestion, Framework, FundingProgramme } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import ProgressBar from "progress";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { acceptMimeTypes, MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { LinkedFile } from "@terramatch-microservices/database/constants/linked-fields";

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
                accept: acceptMimeTypes(config.model as MediaOwnerType, (config.field as LinkedFile).collection)
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
    }
  }
});
