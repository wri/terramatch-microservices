import { EntityApprovalProcessor } from "./types";
import {
  Disturbance,
  Media,
  NurseryReport,
  Seeding,
  SiteReport,
  Tracking,
  TrackingEntry,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { EntityModel, formModelType } from "@terramatch-microservices/database/constants/entities";
import { isPropertyField, LinkedFieldResource } from "@terramatch-microservices/database/constants/linked-fields";
import { LinkedFieldsConfiguration } from "../../linkedFields";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { InternalServerErrorException } from "@nestjs/common";
import { ModelCtor } from "sequelize-typescript";
import { Op } from "sequelize";
import { uniq } from "lodash";

type NothingToReportReport = SiteReport | NurseryReport;

const isNothingToReportReport = (entity: EntityModel): entity is NothingToReportReport =>
  entity instanceof SiteReport || entity instanceof NurseryReport;

const clearTrackings = async (entity: NothingToReportReport) => {
  const trackingIds = Subquery.select(Tracking, "id")
    .eq("trackableType", laravelType(entity))
    .eq("trackableId", entity.id).literal;
  await TrackingEntry.destroy({ where: { trackingId: { [Op.in]: trackingIds } } });
  await Tracking.for(entity).destroy();
};

const RELATION_CLEARERS: Partial<Record<LinkedFieldResource, (entity: NothingToReportReport) => Promise<unknown>>> = {
  treeSpecies: entity => TreeSpecies.for(entity).destroy(),
  seedings: entity => Seeding.for(entity).destroy(),
  disturbances: entity => Disturbance.for(entity).destroy(),
  demographics: clearTrackings,
  restoration: clearTrackings
};

/**
 * Clears form fields, answers, media and relations from a site or nursery report that was submitted
 * with nothingToReport. Identity/metadata (status, title, dates, flags) is left in place so the
 * report remains a valid empty placeholder and does not contribute trees, workdays or other totals.
 */
export const clearNothingToReportData = async (entity: NothingToReportReport) => {
  const resource = formModelType(entity);
  if (resource !== "siteReports" && resource !== "nurseryReports") return;

  const linkedFields = LinkedFieldsConfiguration[resource];
  const attributes = (entity.constructor as ModelCtor).getAttributes();
  const relationResources: LinkedFieldResource[] = Object.values(linkedFields.relations).map(
    ({ resource }) => resource
  );

  for (const field of Object.values(linkedFields.fields)) {
    if (isPropertyField(field)) {
      const property = String(field.property);
      if (property === "title") continue;
      if (attributes[property] == null) continue;
      Object.assign(entity, { [property]: attributes[property].defaultValue ?? null });
    } else if (field.virtual.type === "trackingAggregate" || field.virtual.type === "trackingDescription") {
      relationResources.push(field.virtual.domain);
    }
  }

  entity.answers = null;
  await entity.save();

  if (Object.keys(linkedFields.fileCollections).length > 0) {
    await Media.for(entity).destroy({ individualHooks: true });
  }

  for (const relationResource of uniq(relationResources)) {
    const clearer = RELATION_CLEARERS[relationResource];
    if (clearer == null) {
      throw new InternalServerErrorException(
        `No nothing-to-report clearer for relation resource [${relationResource}]`
      );
    }
    await clearer(entity);
  }
};

export const NothingToReportApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    if (!isNothingToReportReport(entity) || entity.nothingToReport !== true) return;
    await clearNothingToReportData(entity);
  }
};
