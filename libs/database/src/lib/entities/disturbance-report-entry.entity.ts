import {
  Column,
  Table,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Model,
  Index
} from "sequelize-typescript";
import { BIGINT, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { DisturbanceReport } from "./disturbance-report.entity";

@Table({
  tableName: "disturbance_report_entries",
  underscored: true,
  paranoid: true
})
export class DisturbanceReportEntry extends Model<DisturbanceReportEntry> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\DisturbanceReportEntry";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => DisturbanceReport)
  @Column({ type: BIGINT.UNSIGNED, field: "disturbance_report_id" })
  disturbanceReportId: number;

  @Column(STRING)
  name: string;

  @Column({ type: STRING, field: "input_type" })
  inputType: string;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(STRING)
  subtitle: string | null;

  @AllowNull
  @Column(TEXT)
  value: string | null;

  @BelongsTo(() => DisturbanceReport, { foreignKey: "disturbanceReportId" })
  disturbanceReport: DisturbanceReport;
}
