import { Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { STRING } from "sequelize";

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
}
