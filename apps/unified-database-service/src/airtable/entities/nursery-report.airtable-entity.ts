import { AirtableEntity, ColumnMapping } from "./airtable-entity";
import { Nursery, NurseryReport } from "@terramatch-microservices/database/entities";
import { uniq } from "lodash";

type NurseryReportAssociations = {
  nurseryUuid?: string;
};

const COLUMNS: ColumnMapping<NurseryReport, NurseryReportAssociations>[] = [
  "uuid",
  "createdAt",
  "updatedAt",
  {
    airtableColumn: "linkToTerramatch",
    dbColumn: "uuid",
    valueMap: async ({ uuid }) => `https://www.terramatch.org/admin#/nurseryReport/${uuid}/show`
  },
  {
    airtableColumn: "nurseryUuid",
    dbColumn: "nurseryId",
    valueMap: async (_, { nurseryUuid }) => nurseryUuid
  },
  "status",
  "updateRequestStatus",
  "dueAt",
  "seedlingsYoungTrees"
];

export class NurseryReportEntity extends AirtableEntity<NurseryReport, NurseryReportAssociations> {
  readonly TABLE_NAME = "Nursery Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = NurseryReport;

  protected async loadAssociations(nurseryReports: NurseryReport[]) {
    const nurseryIds = uniq(nurseryReports.map(({ nurseryId }) => nurseryId));
    const nurseries = await Nursery.findAll({
      where: { id: nurseryIds },
      attributes: ["id", "uuid"]
    });

    return nurseryReports.reduce(
      (associations, { id, nurseryId }) => ({
        ...associations,
        [id]: {
          nurseryUuid: nurseries.find(({ id }) => id === nurseryId)?.uuid
        }
      }),
      {} as Record<number, NurseryReportAssociations>
    );
  }
}
