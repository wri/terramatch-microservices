/* istanbul ignore file */
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Disturbance, SitePolygon } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/common/util/array";

type SitePolygonAssociations = {
  disturbanceUuid?: string;
};

const COLUMNS: ColumnMapping<SitePolygon, SitePolygonAssociations>[] = [
  ...commonEntityColumns<SitePolygon, SitePolygonAssociations>(),
  "primaryUuid",
  "siteUuid",
  "calcArea",
  {
    airtableColumn: "distr",
    dbColumn: "distr",
    valueMap: async ({ distr }) => distr?.split(",").map(value => value.trim())
  },
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
    valueMap: async ({ plantStart }) => (plantStart == null || isNaN(plantStart.getTime()) ? undefined : plantStart)
  },
  {
    airtableColumn: "practice",
    dbColumn: "practice",
    valueMap: async ({ practice }) => practice?.split(",").map(value => value.trim())
  },
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
