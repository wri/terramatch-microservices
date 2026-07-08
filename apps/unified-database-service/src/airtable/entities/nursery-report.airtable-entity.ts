import { AirtableEntity } from "./airtable-entity";
import { Nursery, NurseryReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { groupBy, uniq } from "lodash";
import { associatedValueColumn, commonEntityColumns, treeAmountRollup, treeDescriptionRollup } from "../util/columns";
import { ColumnMapping, UpdateAssociation } from "../util/types";

type NurseryReportAssociations = {
  nurseryUuid?: string;
  nurserySeedlingAmount: number | null;
  nurserySeedlingNameAndAmount: string;
};

const COLUMNS: ColumnMapping<NurseryReport, NurseryReportAssociations>[] = [
  ...commonEntityColumns<NurseryReport, NurseryReportAssociations>("nurseryReport"),
  associatedValueColumn("nurseryUuid", "nurseryId"),
  "status",
  "updateRequestStatus",
  "dueAt",
  "seedlingsYoungTrees",
  "nothingToReport",
  "sitePrep",
  associatedValueColumn("nurserySeedlingAmount"),
  associatedValueColumn("nurserySeedlingNameAndAmount")
];

const TREE_ASSOCIATION: UpdateAssociation<NurseryReport, TreeSpecies> = {
  model: TreeSpecies,
  on: ["id", "speciesableId"],
  scope: {
    speciesableType: NurseryReport.LARAVEL_TYPE
  }
};

export class NurseryReportEntity extends AirtableEntity<NurseryReport, NurseryReportAssociations> {
  readonly TABLE_NAME = "Nursery Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = NurseryReport;
  readonly UPDATE_ASSOCIATIONS = [TREE_ASSOCIATION];

  protected async loadAssociations(nurseryReports: NurseryReport[]) {
    const nurseryIds = uniq(nurseryReports.map(({ nurseryId }) => nurseryId));
    const nurseries = await Nursery.findAll({
      where: { id: nurseryIds },
      attributes: ["id", "uuid"]
    });
    const treesByReport = groupBy(await TreeSpecies.visible().for(nurseryReports).findAll(), "speciesableId");

    return nurseryReports.reduce(
      (associations, { id, nurseryId }) => ({
        ...associations,
        [id]: {
          nurseryUuid: nurseries.find(({ id }) => id === nurseryId)?.uuid,
          nurserySeedlingAmount: treeAmountRollup(treesByReport[id], "nursery-seedling"),
          nurserySeedlingNameAndAmount: treeDescriptionRollup(treesByReport[id], "nursery-seedling")
        }
      }),
      {} as Record<number, NurseryReportAssociations>
    );
  }
}
