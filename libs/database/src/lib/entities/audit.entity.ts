import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING, TEXT } from "sequelize";
import { AllowNull, AutoIncrement, Column, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { User } from "./user.entity";
import { Dictionary } from "lodash";
import { JsonColumn } from "../decorators/json-column.decorator";
import { LaravelModel, laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

// Note: this is a table that was written in the PHP codebase and is only added to v3
// to support some fallback audit history flows. These records are no longer created. The modern
// audit system is handled on the `audit_statuses` table with the AuditStatus entity model
@Scopes(() => ({
  auditable: <T extends LaravelModel>(models: T | T[]) => {
    models = Array.isArray(models) ? models : [models];
    return {
      where: {
        auditableType: laravelType(models[0]),
        auditableId: models.map(({ id }) => id)
      }
    };
  }
}))
@Table({ tableName: "audits", underscored: true })
export class Audit extends Model<InferAttributes<Audit>, InferCreationAttributes<Audit>> {
  static for<T extends LaravelModel>(auditable: T | T[]) {
    return chainScope(this, "auditable", auditable) as typeof Audit;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @AllowNull
  @Column({ type: STRING, defaultValue: User.LARAVEL_TYPE })
  declare userType: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare userId: number | null;

  @Column(STRING)
  declare event: string;

  @Column(STRING)
  declare auditableType: string;

  @Column(BIGINT.UNSIGNED)
  declare auditableId: number;

  @AllowNull
  @JsonColumn({ type: TEXT, emptyArrayAsObject: true })
  declare oldValues: Dictionary<unknown> | null;

  @AllowNull
  @JsonColumn({ type: TEXT, emptyArrayAsObject: true })
  declare newValues: Dictionary<unknown> | null;

  @AllowNull
  @Column(STRING)
  declare url: string | null;

  @AllowNull
  @Column(STRING(45))
  declare ipAddress: string | null;

  @AllowNull
  @Column(STRING(1023))
  declare userAgent: string | null;

  @AllowNull
  @Column(STRING)
  declare tags: string | null;
}
