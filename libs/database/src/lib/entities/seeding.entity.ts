import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DOUBLE, STRING, UUID } from "sequelize";
import { TreeSpeciesResearch } from "./tree-species-research.entity";

@Table({
  tableName: "v2_seedings",
  underscored: true,
  paranoid: true,
  // Multi-column @Index doesn't work with underscored column names
  indexes: [{ name: "v2_seedings_morph_index", fields: ["seedable_id", "seedable_type"] }]
})
export class Seeding extends Model<Seeding> {
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

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @AllowNull
  @Column(DOUBLE)
  weightOfSample: number;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  seedsInSample: number;

  @Column(STRING)
  seedableType: string;

  @Column(BIGINT.UNSIGNED)
  seedableId: number;
}
