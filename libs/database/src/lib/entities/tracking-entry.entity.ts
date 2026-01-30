import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, INTEGER, STRING } from "sequelize";
import { chainScope } from "../util/chain-scope";
import { Tracking } from "./tracking.entity";

@Scopes(() => ({
  gender: { where: { type: "gender" } },
  tracking: (id: number) => ({ where: { trackingId: id } })
}))
@Table({
  tableName: "tracking_entries",
  underscored: true,
  paranoid: true
})
export class TrackingEntry extends Model<InferAttributes<TrackingEntry>, InferCreationAttributes<TrackingEntry>> {
  static tracking(id: number) {
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
