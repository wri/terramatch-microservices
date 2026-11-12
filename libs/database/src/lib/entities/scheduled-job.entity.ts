import { AutoIncrement, Column, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, DATE, Op, STRING } from "sequelize";
import { isArray } from "lodash";
import { JsonColumn } from "../decorators/json-column.decorator";
import {
  ScheduledJobDefinition,
  ScheduledJobType,
  SITE_AND_NURSERY_REMINDER,
  SiteAndNurseryReminder,
  TASK_DUE,
  TaskDue
} from "../constants/scheduled-jobs";
import { FrameworkKey } from "../constants";
import { chainScope } from "../util/chain-scope";
import { InternalServerErrorException } from "@nestjs/common";

@Scopes(() => ({
  taskDue: (frameworks: FrameworkKey | readonly FrameworkKey[]) => ({
    where: {
      // A JSON path where clause does not expand an array into IN (...) on its own.
      "taskDefinition.frameworkKey": isArray(frameworks) ? { [Op.in]: frameworks } : frameworks,
      type: TASK_DUE
    },
    order: [["executionTime", "ASC"]]
  })
}))
@Table({ tableName: "scheduled_jobs", underscored: true, paranoid: true })
export class ScheduledJob extends Model<ScheduledJob> {
  static get sql() {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("ScheduledJob model is missing sequelize connection");
    }
    return this.sequelize;
  }

  static taskDue(frameworks: FrameworkKey | readonly FrameworkKey[]) {
    return chainScope(this, "taskDue", frameworks) as typeof ScheduledJob;
  }

  static async scheduleTaskDue(executionTime: Date, frameworkKey: FrameworkKey, dueAt: Date) {
    const taskDefinition: TaskDue = { frameworkKey, dueAt: dueAt.toISOString() };
    await ScheduledJob.create({ type: TASK_DUE, executionTime, taskDefinition } as ScheduledJob);
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
  declare id: number;

  @Column(STRING)
  declare type: ScheduledJobType;

  @Column(DATE)
  declare executionTime: Date;

  @JsonColumn()
  declare taskDefinition: ScheduledJobDefinition;
}
