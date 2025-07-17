import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, DATE, STRING } from "sequelize";
import { JsonColumn } from "../decorators/json-column.decorator";
import {
  REPORT_REMINDER,
  ReportReminder,
  ScheduledJobDefinition,
  ScheduledJobType,
  SITE_AND_NURSERY_REMINDER,
  SiteAndNurseryReminder,
  TASK_DUE,
  TaskDue
} from "../constants/scheduled-jobs";
import { FrameworkKey } from "../constants/framework";

@Table({ tableName: "scheduled_jobs", underscored: true, paranoid: true })
export class ScheduledJob extends Model<ScheduledJob> {
  static async scheduleTaskDue(executionTime: Date, frameworkKey: FrameworkKey, dueAt: Date) {
    const taskDefinition: TaskDue = { frameworkKey, dueAt: dueAt.toISOString() };
    await ScheduledJob.create({ type: TASK_DUE, executionTime, taskDefinition } as ScheduledJob);
  }

  static async scheduleReportReminder(executionTime: Date, frameworkKey: FrameworkKey) {
    const taskDefinition: ReportReminder = { frameworkKey };
    await ScheduledJob.create({ type: REPORT_REMINDER, executionTime, taskDefinition } as ScheduledJob);
  }

  static async scheduleSiteAndNurseryReminder(executionTime: Date, frameworkKey: FrameworkKey) {
    const taskDefinition: SiteAndNurseryReminder = { frameworkKey };
    await ScheduledJob.create({
      type: SITE_AND_NURSERY_REMINDER,
      executionTime,
      taskDefinition
    } as ScheduledJob);
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  type: ScheduledJobType;

  @Column(DATE)
  executionTime: Date;

  @JsonColumn()
  taskDefinition: ScheduledJobDefinition;
}
