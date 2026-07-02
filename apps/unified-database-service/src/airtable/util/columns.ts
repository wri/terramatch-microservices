import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { Model } from "sequelize-typescript";
import { Attributes } from "sequelize";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { AirtableValue, ColumnMapping } from "./types";
import { isObject } from "lodash";

export const commonEntityColumns = <T extends UuidModel, A = Record<string, never>>(adminSiteType?: string) =>
  [
    "uuid",
    "createdAt",
    "updatedAt",
    ...(adminSiteType == null
      ? []
      : [
          {
            airtableColumn: "linkToTerramatch",
            dbColumn: "uuid",
            valueMap: (record: UuidModel) => `https://www.terramatch.org/admin#/${adminSiteType}/${record.uuid}/show`
          }
        ])
  ] as ColumnMapping<T, A>[];

export const associatedValueColumn = <T extends Model, A>(
  valueName: keyof A,
  dbColumn?: keyof Attributes<T> | (keyof Attributes<T>)[]
): ColumnMapping<T, A> => ({
  airtableColumn: valueName as string,
  dbColumn,
  valueMap: async (_, associations: A) => associations?.[valueName] as AirtableValue
});

export const percentageColumn = <T extends Model, A = Record<string, never>>(
  dbColumn: keyof Attributes<T>
): ColumnMapping<T, A> => ({
  airtableColumn: dbColumn as string,
  dbColumn,
  valueMap: async model => ((model[dbColumn] as number | null) ?? 0) / 100
});

const filterTrees = (trees: TreeSpecies[] | null | undefined, collection: string) =>
  (trees ?? []).filter(tree => tree.collection === collection);

export const treeAmountRollup = (trees: TreeSpecies[] | null | undefined, collection: string) =>
  filterTrees(trees, collection).reduce(
    (sum, tree) => (tree.amount == null ? sum : (sum ?? 0) + tree.amount),
    null as number | null
  );

export const treeDescriptionRollup = (trees: TreeSpecies[] | null | undefined, collection: string) =>
  filterTrees(trees, collection)
    .reduce(
      (descriptions, tree) => [...descriptions, `${tree.name} (${(tree.amount ?? "").toLocaleString()})`],
      [] as string[]
    )
    .join(", ");

// used in the test suite
export const airtableColumnName = <T extends Model>(mapping: ColumnMapping<T, never>) =>
  isObject(mapping) ? mapping.airtableColumn : (mapping as string);
