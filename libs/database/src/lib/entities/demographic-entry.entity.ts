import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING } from "sequelize";
import { Demographic } from "./demographic.entity";
import { chainScope } from "../util/chainScope";

@Scopes(() => ({
  gender: { where: { type: "gender" } }
}))
@Table({
  tableName: "demographic_entries",
  underscored: true,
  paranoid: true
})
export class DemographicEntry extends Model<DemographicEntry> {
  static gender() {
    return chainScope(this, "gender") as typeof DemographicEntry;
  }

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

  @ForeignKey(() => Demographic)
  @Column(BIGINT.UNSIGNED)
  demographicId: number;
}
