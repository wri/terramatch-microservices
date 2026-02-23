import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, Op, STRING } from "sequelize";
import { chainScope } from "../util/chain-scope";
import { Tracking } from "./tracking.entity";
import { Literal } from "sequelize/types/utils";
import { isNumber } from "lodash";

@Scopes(() => ({
  gender: { where: { type: "gender" } },
  tracking: (id: number | Literal) => ({ where: { trackingId: isNumber(id) ? id : { [Op.in]: id } } })
}))
@Table({
  tableName: "tracking_entries",
  underscored: true,
  paranoid: true
})
export class TrackingEntry extends Model<InferAttributes<TrackingEntry>, InferCreationAttributes<TrackingEntry>> {
  static tracking(id: number | Literal) {
    return chainScope(this, "tracking", id) as typeof TrackingEntry;
  }

  static gender() {
    return chainScope(this, "gender") as typeof TrackingEntry;
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

  @ForeignKey(() => Tracking)
  @Column(BIGINT.UNSIGNED)
  trackingId: number;
}
