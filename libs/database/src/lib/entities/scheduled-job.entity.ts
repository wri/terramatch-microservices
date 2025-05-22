import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import { ScheduledJobType } from "../constants/scheduled-jobs";

@Table({ tableName: "scheduled_jobs", underscored: true, paranoid: true })
export class ScheduledJob extends Model<ScheduledJob> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  type: ScheduledJobType;

  @Column(DATE)
  executionTime: Date;

  @JsonColumn()
  taskDefinition: object;
}
