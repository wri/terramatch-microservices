import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, STRING } from "sequelize";
import { Demographic } from "./demographic.entity";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  gender: { where: { type: "gender" } },
  demographic: (id: number) => ({ where: { demographicId: id } })
}))
@Table({
  tableName: "demographic_entries",
  underscored: true,
  paranoid: true
})
export class DemographicEntry extends Model<
  InferAttributes<DemographicEntry>,
  InferCreationAttributes<DemographicEntry>
> {
  static demographic(id: number) {
    return chainScope(this, "demographic", id) as typeof DemographicEntry;
  }

  static gender() {
    return chainScope(this, "gender") as typeof DemographicEntry;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Column(STRING)
  type: string;

  @AllowNull
  @Column(STRING)
  subtype: string | null;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @Column(INTEGER({ length: 10 }))
  amount: number;

  @ForeignKey(() => Demographic)
  @Column(BIGINT.UNSIGNED)
  demographicId: number;
}
