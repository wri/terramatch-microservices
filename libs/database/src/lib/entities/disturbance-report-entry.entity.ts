import {
  Column,
  Table,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Model,
  Index,
  Scopes
} from "sequelize-typescript";
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { DisturbanceReport } from "./disturbance-report.entity";
import { chainScope } from "../util/chain-scope";

@Table({
  tableName: "disturbance_report_entries",
  underscored: true,
  paranoid: true
})
@Scopes(() => ({
  report: (id: number) => ({ where: { disturbanceReportId: id } })
}))
export class DisturbanceReportEntry extends Model<
  InferAttributes<DisturbanceReportEntry>,
  InferCreationAttributes<DisturbanceReportEntry>
> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\DisturbanceReportEntry";

  static report(id: number) {
    return chainScope(this, "report", id) as typeof DisturbanceReportEntry;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => DisturbanceReport)
  @Column({ type: BIGINT.UNSIGNED })
  declare disturbanceReportId: number;

  @Column(STRING)
  declare name: string;

  @Column({ type: STRING })
  declare inputType: string;

  @AllowNull
  @Column(STRING)
  declare title: string | null;

  @AllowNull
  @Column(STRING)
  declare subtitle: string | null;

  @AllowNull
  @Column(TEXT)
  declare value: string | null;

  @BelongsTo(() => DisturbanceReport)
  declare disturbanceReport: CreationOptional<DisturbanceReport>;
}
