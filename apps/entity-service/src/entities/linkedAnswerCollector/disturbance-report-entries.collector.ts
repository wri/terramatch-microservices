import { DisturbanceReport, DisturbanceReportEntry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { EmbeddedDisturbanceReportEntryDto } from "../dto/disturbance-report-entry.dto";
import { isEmpty } from "lodash";
import { Op } from "sequelize";

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

    async syncRelation(model, field, answer) {
      if (!(model instanceof DisturbanceReport)) {
        logger.error("disturbanceReportEntries is only supported on disturbanceReports", { answer, field });
        return;
      }

      const dtos = (answer ?? []) as EmbeddedDisturbanceReportEntryDto[];
      const existing = await DisturbanceReportEntry.findAll({ where: { disturbanceReport: model.id } });
      const entryIds: number[] = [];
      await Promise.all(
        dtos.map(async dto => {
          if (isEmpty(dto.name)) return;

          let entry = existing.find(({ uuid }) => uuid === dto.uuid) ?? existing.find(({ name }) => name === dto.name);
          if (entry == null) {
            entry = await DisturbanceReportEntry.create({
              disturbanceReportId: model.id,
              inputType: dto.inputType,
              name: dto.name,
              title: dto.title,
              subtitle: dto.subtitle,
              value: dto.value
            });
          } else {
            await entry.update({
              inputType: dto.inputType,
              title: dto.title,
              subtitle: dto.subtitle,
              value: dto.value
            });
          }
          entryIds.push(entry.id);
        })
      );

      await DisturbanceReportEntry.destroy({ where: { disturbanceReportId: model.id, id: { [Op.notIn]: entryIds } } });
    }
  };
}
