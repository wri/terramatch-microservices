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
  override id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @ForeignKey(() => DisturbanceReport)
  @Column({ type: BIGINT.UNSIGNED })
  disturbanceReportId: number;

  @Column(STRING)
  name: string;

  @Column({ type: STRING })
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

  @BelongsTo(() => DisturbanceReport)
  disturbanceReport: CreationOptional<DisturbanceReport>;
}
