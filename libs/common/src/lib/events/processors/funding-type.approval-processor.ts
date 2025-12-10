import { EntityApprovalProcessor } from "./types";
import { TMLogger } from "../../util/tm-logger";
import { FinancialReport, FundingType, Organisation } from "@terramatch-microservices/database/entities";

const logger = new TMLogger("FundingTypeApprovalProcessor");

export const FundingTypeApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    if (!(entity instanceof FinancialReport)) return;

    const { uuid } = (await Organisation.findOne({ where: { id: entity.organisationId }, attributes: ["uuid"] })) ?? {};
    if (uuid == null) {
      logger.warn(`No organisation found for financial report ${entity.id}`);
      return;
    }

    // Replace the org funding types with the rows from the newly approved financial report
    await FundingType.destroy({ where: { organisationId: uuid, financialReportId: null } });
    const fundingTypes = await FundingType.findAll({ where: { financialReportId: entity.id } });
    await FundingType.bulkCreate(
      fundingTypes.map(({ source, amount, year, type }) => ({ organisationId: uuid, source, amount, year, type }))
    );
  }
};
