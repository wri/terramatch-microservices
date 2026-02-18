import { FinancialReport, FundingType, Organisation } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { Dictionary } from "lodash";
import { EmbeddedFundingTypeDto } from "../../dto/funding-type.dto";
import { Op, WhereAttributeHash } from "sequelize";
import { FormModel } from "@terramatch-microservices/database/constants/entities";

export function fundingTypesCollector(logger: LoggerService): RelationResourceCollector {
  const questions: Dictionary<string> = {};

  const orgInfo = async (model: FormModel) => {
    const isOrg = model instanceof Organisation;
    if (!isOrg && !(model instanceof FinancialReport)) {
      throw new InternalServerErrorException("Only orgs and financialReports are supported for fundingTypes");
    }

    const orgUuid = isOrg
      ? model.uuid
      : (await Organisation.findOne({ where: { id: model.organisationId }, attributes: ["uuid"] }))?.uuid;
    if (orgUuid == null) {
      throw new InternalServerErrorException("Organisation not found for fundingTypes");
    }

    return { isOrg, orgUuid };
  };

  return {
    addField(_, modelType, questionUuid) {
      if (questions[modelType] != null) {
        logger.warn(`Duplicate field for fundingTypes on ${modelType}`);
      }
      questions[modelType] = questionUuid;
    },

    async collect(answers, models) {
      if (models.organisations != null && models.financialReports != null) {
        throw new InternalServerErrorException(
          "Only one of financialReports or organisations can be set for fundingTypes."
        );
      }
      const modelType = Object.keys(models)[0];

      const fundingTypes = await FundingType.findAll({
        where:
          modelType === "organisations"
            ? { organisationId: models.organisations?.uuid, financialReportId: null }
            : { financialReportId: models.financialReports?.id },
        attributes: ["uuid", "year", "type", "source", "amount"]
      });

      answers[Object.values(questions)[0]] = fundingTypes.map(fundingType => new EmbeddedFundingTypeDto(fundingType));
    },

    async syncRelation(model, _, answer) {
      const { isOrg, orgUuid } = await orgInfo(model);

      const fundingTypeWhere: WhereAttributeHash<FundingType> = isOrg
        ? { organisationId: orgUuid, financialReportId: null }
        : { financialReportId: model.id };
      if (answer == null || answer.length === 0) {
        await FundingType.destroy({ where: fundingTypeWhere });
        return;
      }

      const includedIds: number[] = [];
      const fundingTypes = await FundingType.findAll({ where: fundingTypeWhere });
      const dtos = answer as EmbeddedFundingTypeDto[];
      await Promise.all(
        dtos.map(async dto => {
          if (dto.amount == null || dto.year == null || dto.type == null) {
            logger.warn("Missing required fundingType fields", { dto });
            return;
          }

          let existing = fundingTypes.find(fundingType => {
            if (fundingType.uuid === dto.uuid) return true;
            if (
              (fundingType.source == null) !== (dto.source == null) ||
              (dto.source != null && dto.source !== fundingType.source)
            )
              return false;
            return fundingType.type === dto.type && fundingType.year === dto.year;
          });

          if (existing == null) {
            existing = await FundingType.create({
              organisationId: orgUuid,
              financialReportId: isOrg ? null : model.id,
              source: dto.source,
              amount: dto.amount,
              year: dto.year,
              type: dto.type
            });
          } else {
            await existing.update({
              source: dto.source,
              amount: dto.amount,
              year: dto.year,
              type: dto.type
            });
          }

          includedIds.push(existing.id);
        })
      );

      await FundingType.destroy({ where: { ...fundingTypeWhere, id: { [Op.notIn]: includedIds } } });
    },

    async clearRelations(model) {
      const { isOrg, orgUuid } = await orgInfo(model);
      const fundingTypeWhere: WhereAttributeHash<FundingType> = isOrg
        ? { organisationId: orgUuid, financialReportId: null }
        : { financialReportId: model.id };
      await FundingType.destroy({ where: fundingTypeWhere });
    }
  };
}
