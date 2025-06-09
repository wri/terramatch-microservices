import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Scopes, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, ENUM, NOW, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { LaravelModel, laravelType } from "../types/util";
import { chainScope } from "../util/chain-scope";

const TYPES = ["change-request", "status", "submission", "comment", "change-request-updated", "reminder-sent"] as const;
type AuditStatusType = (typeof TYPES)[number];

@Scopes(() => ({
  auditable: (auditable: LaravelModel) => ({
    where: {
      auditableType: laravelType(auditable),
      auditableId: auditable.id
    }
  })
}))
@Table({
  tableName: "audit_statuses",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names in all contexts
  indexes: [{ name: "audit_statuses_auditable_type_auditable_id_index", fields: ["auditable_type", "auditable_id"] }]
})
export class AuditStatus extends Model<AuditStatus> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\AuditStatus";
  static readonly MEDIA = {
    attachments: { multiple: true, validation: "general-documents" }
  };

  static for(auditable: LaravelModel) {
    return chainScope(this, "auditable", auditable) as typeof AuditStatus;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @AllowNull
  @Column(TEXT)
  comment: string | null;

  @AllowNull
  @Column(STRING)
  firstName: string | null;

  @AllowNull
  @Column(STRING)
  lastName: string | null;

  @AllowNull
  @Column({ type: ENUM, values: TYPES })
  type: AuditStatusType | null;

  /**
   * @deprecated
   *
   * All records in the DB have null for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column(BOOLEAN)
  isSubmitted: boolean | null;

  /**
   * @deprecated
   *
   * All records in the DB have true for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column({ type: BOOLEAN, defaultValue: true })
  isActive: boolean | null;

  /**
   * @deprecated
   *
   * All records in the DB have null for this field, so it seems not to be useful.
   */
  @AllowNull
  @Column(BOOLEAN)
  requestRemoved: boolean | null;

  /**
   * @deprecated
   *
   * Needs an investigation to see if this field is being used anywhere, but it is totally superfluous with the
   * automatic createdAt field.
   **/
  @AllowNull
  @Column({ type: DATE, defaultValue: NOW })
  dateCreated: Date | null;

  @AllowNull
  @Column(STRING)
  createdBy: string | null;

  @Column(STRING)
  auditableType: string;

  @Column(BIGINT.UNSIGNED)
  auditableId: number;
}
