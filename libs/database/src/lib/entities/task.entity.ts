import { AllowNull, AutoIncrement, Column, HasOne, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";
import { ProjectReport } from "./project-report.entity";

@Table({ tableName: "v2_tasks", underscored: true, paranoid: true })
export class Task extends Model<Task> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Tasks\\Task";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @HasOne(() => ProjectReport)
  projectReport: ProjectReport | null;
}
