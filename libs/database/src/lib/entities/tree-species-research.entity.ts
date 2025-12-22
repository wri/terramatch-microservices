import { AllowNull, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { STRING } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "tree_species_research", underscored: true, paranoid: true })
export class TreeSpeciesResearch extends Model<TreeSpeciesResearch> {
  @PrimaryKey
  @Column(STRING)
  taxonId: string;

  @Unique
  @Column(STRING)
  scientificName: string;

  @Column(STRING)
  family: string;

  @Column(STRING)
  genus: string;

  @Column(STRING)
  specificEpithet: string;

  @Column(STRING)
  infraspecificEpithet: string;

  @AllowNull
  @JsonColumn()
  nativeDistribution: string[] | null;

  @AllowNull
  @JsonColumn()
  suitability: string[] | null;
}
