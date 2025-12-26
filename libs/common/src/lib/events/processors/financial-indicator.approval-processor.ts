import { TMLogger } from "../../util/tm-logger";
import { EntityApprovalProcessor } from "./types";
import { FinancialIndicator, FinancialReport, Media, Organisation } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

const logger = new TMLogger("FinancialIndicatorApprovalProcessor");

export const FinancialIndicatorApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity, mediaService) {
    if (!(entity instanceof FinancialReport)) return;

    const org = await Organisation.findOne({
      where: { id: entity.organisationId },
      attributes: ["id", "finStartMonth", "currency"]
    });
    if (org == null) {
      logger.warn(`No organisation found for financial report ${entity.id}`);
      return;
    }

    const { finStartMonth, currency } = entity;
    await org.update({ finStartMonth, currency: currency ?? org.currency });

    const reportIndicators = await FinancialIndicator.financialReport(entity.id).findAll();
    const orgIndicators = await FinancialIndicator.organisation(org.id).findAll();
    const reportDocumentation =
      reportIndicators.length === 0 ? [] : await Media.for(reportIndicators).collection("documentation").findAll();
    const orgDocumentation =
      orgIndicators.length === 0 ? [] : await Media.for(orgIndicators).collection("documentation").findAll();
    const orgIndicatorKeepIds: number[] = [];
    // Due to the media duplication need, this is awkward to do in bulk and doesn't happen
    // very often, so we just run through them sequentially.
    await Promise.all(
      reportIndicators.map(async reportIndicator => {
        const { year, collection, amount, description, exchangeRate } = reportIndicator;
        let orgIndicator = orgIndicators.find(
          orgIndicator => orgIndicator.year === year && orgIndicator.collection === collection
        );
        if (orgIndicator == null) {
          orgIndicator = await FinancialIndicator.create({
            organisationId: org.id,
            year,
            collection,
            amount,
            description,
            exchangeRate
          });
        } else {
          await orgIndicator.update({ amount, description, exchangeRate });
        }

        orgIndicatorKeepIds.push(orgIndicator.id);

        await Promise.all(
          reportDocumentation
            .filter(({ modelId }) => modelId === reportIndicator.id)
            .map(async media => {
              const orgMedia = orgDocumentation.find(
                orgDoc =>
                  orgDoc.modelId === orgIndicator.id && orgDoc.fileName === media.fileName && orgDoc.size === media.size
              );
              if (orgMedia == null) await mediaService.duplicateMedia(media, orgIndicator);
            })
        );
      })
    );

    await FinancialIndicator.organisation(org.id).destroy({ where: { id: { [Op.notIn]: orgIndicatorKeepIds } } });
  }
};
