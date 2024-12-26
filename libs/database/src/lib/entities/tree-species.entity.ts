import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, UUID } from "sequelize";
import { TreeSpeciesResearch } from "./tree-species-research.entity";

@Table({
  tableName: "v2_tree_species",
  underscored: true,
  paranoid: true,
  // Multi-column @Index doesn't work with underscored column names
  indexes: [
    { name: "tree_species_type_id_collection", fields: ["collection", "speciesable_id", "speciesable_type"] },
    { name: "v2_tree_species_morph_index", fields: ["speciesable_id", "speciesable_type"] }
  ]
})
export class TreeSpecies extends Model<TreeSpecies> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @AllowNull
  @ForeignKey(() => TreeSpeciesResearch)
  @Column(STRING)
  taxonId: string | null;

  @AllowNull
  @Column(BIGINT)
  amount: number | null;

  @AllowNull
  @Index("v2_tree_species_collection_index")
  @Column(STRING)
  collection: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @Column(STRING)
  speciesableType: string;

  @Column(BIGINT.UNSIGNED)
  speciesableId: number;
}
