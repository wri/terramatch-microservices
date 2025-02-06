import { AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, TEXT, UUID } from "sequelize";
import { DemographicEntry } from "./demographic-entry.entity";

@Table({
  tableName: "demographics",
  underscored: true,
  paranoid: true,
  indexes: [
    // @Index doesn't work with underscored column names
    { name: "demographics_morph_index", fields: ["demographical_id", "demographical_type"] }
  ]
})
export class Demographic extends Model<Demographic> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(STRING)
  demographicalType: string;

  @Column(BIGINT.UNSIGNED)
  demographicalId: number;

  @AllowNull
  @Column(TEXT)
  description: string;

  @Column({ type: BOOLEAN, defaultValue: false })
  hidden: boolean;

  @HasMany(() => DemographicEntry, { constraints: false })
  entries: DemographicEntry[] | null;
}
