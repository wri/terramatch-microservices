/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Disturbance, SitePolygon } from "@terramatch-microservices/database/entities";
import { isDate, isString, uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type SitePolygonAssociations = {
  disturbanceUuid?: string;
};

const COLUMNS: ColumnMapping<SitePolygon, SitePolygonAssociations>[] = [
  ...commonEntityColumns<SitePolygon, SitePolygonAssociations>(),
  "primaryUuid",
  "siteUuid",
  "calcArea",
  "distr",
  "numTrees",
  "validationStatus",
  "status",
  "isActive",
  associatedValueColumn("disturbanceUuid", "disturbanceId"),
  "versionName",
  "polyName",
  {
    airtableColumn: "plantStart",
    dbColumn: "plantStart",
    valueMap: async ({ plantStart }) => {
      if (plantStart == null) return undefined;
      // The invalid date I thought would come in as a Date instance with invalid time, but it seems
      // to be coming in as a string instead. Covering both cases in case the behavior changes.
      if (isDate(plantStart) && isNaN(plantStart.getTime())) return undefined;
      if (isString(plantStart) && plantStart === "0000-00-00") return undefined;
      return plantStart;
    }
  },
  "practice",
  "targetSys"
];

export class SitePolygonEntity extends AirtableEntity<SitePolygon, SitePolygonAssociations> {
  readonly TABLE_NAME = "Site Polygons";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = SitePolygon;

  protected async loadAssociations(sitePolygons: SitePolygon[]) {
    const disturbanceIds = uniq(sitePolygons.map(({ disturbanceId }) => disturbanceId)).filter(isNotNull);
    const disturbances =
      disturbanceIds.length == 0
        ? []
        : await Disturbance.findAll({
            where: { id: disturbanceIds },
            attributes: ["id", "uuid"]
          });
    return sitePolygons.reduce(
      (associations, { id, disturbanceId }) => ({
        ...associations,
        [id]: {
          disturbanceUuid: disturbanceId == null ? undefined : disturbances.find(({ id }) => id === disturbanceId)?.uuid
        }
      }),
      {} as Record<number, SitePolygonAssociations>
    );
  }
}
