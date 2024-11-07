import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, UUID } from "sequelize";
import { Site } from "./site.entity";

@Table({ tableName: "v2_tree_species", underscored: true, paranoid: true })
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
  @Column(BIGINT)
  amount: number | null;

  @AllowNull
  @Index("v2_tree_species_collection_index")
  @Index("tree_species_type_id_collection")
  @Column(STRING)
  collection: string | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @Column(STRING)
  @Index("tree_species_type_id_collection")
  @Index("v2_tree_species_morph_index")
  speciesableType: string;

  @Column(BIGINT.UNSIGNED)
  @Index("tree_species_type_id_collection")
  @Index("v2_tree_species_morph_index")
  speciesableId: number;

  @BelongsTo(() => Site, { foreignKey: "speciesableId", scope: { speciesableType: "App\\Models\\V2\\Sites\\Site" } })
  site: Site | null;
}
