import { DisturbanceReportEntry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { EmbeddedDisturbanceReportEntryDto } from "../dto/disturbance-report-entry.dto";

export function disturbanceReportEntriesCollector(logger: LoggerService): RelationResourceCollector {
  let questionUuid: string;

  return {
    addField(_, modelType, addQuestionUuid) {
      if (modelType !== "disturbanceReports") {
        throw new InternalServerErrorException("disturbanceReportEntries is only supported on disturbanceReports");
      }
      if (questionUuid != null) {
        logger.warn("Duplicate field for disturbanceReportEntries on disturbanceReports");
      }
      questionUuid = addQuestionUuid;
    },

    async collect(answers, models) {
      if (models.disturbanceReports == null) {
        logger.warn("missing disturbanceReport for disturbanceReportEntries");
        return;
      }

      const entries = await DisturbanceReportEntry.findAll({
        where: { disturbanceReport: models.disturbanceReports.id }
      });
      answers[questionUuid] = entries.map(entry => new EmbeddedDisturbanceReportEntryDto(entry));
    },

    async syncRelation() {
      // TODO TM-2624
    }
  };
}
