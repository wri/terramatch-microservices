import { AllowNull, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { STRING } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "tree_species_research", underscored: true, paranoid: true })
export class TreeSpeciesResearch extends Model<TreeSpeciesResearch> {
  @PrimaryKey
  @Column(STRING)
  declare taxonId: string;

  @Unique
  @Column(STRING)
  declare scientificName: string;

  @Column(STRING)
  declare family: string;

  @Column(STRING)
  declare genus: string;

  @Column(STRING)
  declare specificEpithet: string;

  @Column(STRING)
  declare infraspecificEpithet: string;

  @AllowNull
  @JsonColumn()
  declare nativeDistribution: string[] | null;

  @AllowNull
  @JsonColumn()
  declare suitability: string[] | null;
}
