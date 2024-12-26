import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";

@Table({
  tableName: "demographics",
  underscored: true,
  paranoid: true,
  indexes: [
    // Multi-column @Index doesn't work with underscored column names
    { name: "demographics_morph_index", fields: ["demographical_id", "demographical_type"] }
  ]
})
export class Demographic extends Model<Demographic> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  subtype: string;

  @AllowNull
  @Column(STRING)
  name: string;

  @Column(INTEGER({ length: 10 }))
  amount: number;

  @Column(STRING)
  demographicalType: string;

  @Column(BIGINT.UNSIGNED)
  demographicalId: number;
}
