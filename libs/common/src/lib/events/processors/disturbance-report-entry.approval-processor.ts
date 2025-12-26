import { EntityApprovalProcessor } from "./types";
import {
  Disturbance,
  DisturbanceReport,
  DisturbanceReportEntry,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { Attributes, CreationAttributes } from "sequelize";
import { DateTime } from "luxon";
import { Dictionary } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { laravelType } from "@terramatch-microservices/database/types/util";

type DisturbanceAttribute = keyof Attributes<Disturbance>;
type DisturbanceMapping<C extends DisturbanceAttribute> = {
  column: C;
  mapper: (value: string | null) => Attributes<Disturbance>[C];
};

const mapValue = (value: string | null) => value;
const mapJson = (value: string | null) => {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const mapNumber = (value: string | null) => {
  if (value == null) return null;
  const number = Number(value);
  return isNaN(number) ? null : number;
};
const mapDate = (value: string | null) => (value == null ? null : DateTime.fromISO(value).toJSDate());

const intensity: DisturbanceMapping<"intensity"> = { column: "intensity", mapper: mapValue };
const extent: DisturbanceMapping<"extent"> = { column: "extent", mapper: mapValue };
const type: DisturbanceMapping<"type"> = { column: "type", mapper: mapValue };
const subtype: DisturbanceMapping<"subtype"> = { column: "subtype", mapper: mapJson };
const peopleAffected: DisturbanceMapping<"peopleAffected"> = { column: "peopleAffected", mapper: mapNumber };
const monetaryDamage: DisturbanceMapping<"monetaryDamage"> = { column: "monetaryDamage", mapper: mapNumber };
const propertyAffected: DisturbanceMapping<"propertyAffected"> = { column: "propertyAffected", mapper: mapJson };
const disturbanceDate: DisturbanceMapping<"disturbanceDate"> = { column: "disturbanceDate", mapper: mapDate };

const DISTURBANCE_MAPPING = {
  intensity,
  extent,
  "disturbance-type": type,
  "disturbance-subtype": subtype,
  "people-affected": peopleAffected,
  "monetary-damage": monetaryDamage,
  "property-affected": propertyAffected,
  "date-of-disturbance": disturbanceDate
};

type AffectedPolygon = { polyUuid?: string };

export const DisturbanceReportEntryApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    if (!(entity instanceof DisturbanceReport)) return;

    const entries = await DisturbanceReportEntry.report(entity.id).findAll();
    const disturbanceData: CreationAttributes<Disturbance> = {
      disturbanceableType: laravelType(entity),
      disturbanceableId: entity.id,
      description: entity.description,
      actionDescription: entity.actionDescription
    };

    // Look for entries that contain affected polygon UUIDs
    const affectedPolygonUuids = entries.reduce((uuids, entry) => {
      const mapping = DISTURBANCE_MAPPING[entry.name as keyof typeof DISTURBANCE_MAPPING];
      if (mapping != null) {
        (disturbanceData as Dictionary<unknown>)[mapping.column] = mapping.mapper(entry.value);
      }

      if (entry.name !== "polygon-affected" || entry.value == null) return uuids;

      const polygons = mapJson(entry.value) as AffectedPolygon[][] | null;
      if (polygons == null || polygons.length === 0) return uuids;

      const newUuids = polygons.flatMap(group => group.map(p => p.polyUuid)).filter(isNotNull);
      return [...uuids, ...newUuids];
    }, [] as string[]);

    if (affectedPolygonUuids.length === 0) {
      // If there are no affected polygons, we don't create the disturbance.
      return;
    }

    let disturbance = await Disturbance.for(entity).findOne();
    if (disturbance == null) {
      disturbance = await Disturbance.create(disturbanceData);
    } else {
      await disturbance.update(disturbanceData);
    }

    // Remove disturbance id from all polygons that were previously assigned to this disturbance
    await SitePolygon.disturbance(disturbance.id).active().update({ disturbanceId: null }, { where: {} });

    // Add the disturbance id to all affected polygons that were not already assigned a disturbance
    await SitePolygon.forUuids(affectedPolygonUuids)
      .active()
      .update({ disturbanceId: disturbance.id }, { where: { disturbanceId: null } });
  }
};
