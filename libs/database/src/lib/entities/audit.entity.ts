import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING, TEXT } from "sequelize";
import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { User } from "./user.entity";
import { Dictionary } from "lodash";
import { JsonColumn } from "../decorators/json-column.decorator";

// Note: this is a table that was written in the PHP codebase and is only added to v3
// to support some fallback audit history flows. These records are no longer created. The modern
// audit system is handled on the `audit_statuses` table with the AuditStatus entity model
@Table({ tableName: "audits", underscored: true })
export class Audit extends Model<InferAttributes<Audit>, InferCreationAttributes<Audit>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @AllowNull
  @Column({ type: STRING, defaultValue: User.LARAVEL_TYPE })
  userType: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  userId: number | null;

  @Column(STRING)
  event: string;

  @Column(STRING)
  auditableType: string;

  @Column(BIGINT.UNSIGNED)
  auditableId: number;

  @AllowNull
  @JsonColumn({ type: TEXT })
  oldValues: Dictionary<unknown> | null;

  @AllowNull
  @JsonColumn({ type: TEXT })
  newValues: Dictionary<unknown> | null;

  @AllowNull
  @Column(STRING)
  url: string | null;

  @AllowNull
  @Column(STRING(45))
  ipAddress: string | null;

  @AllowNull
  @Column(STRING(1023))
  userAgent: string | null;

  @AllowNull
  @Column(STRING)
  tags: string | null;
}
