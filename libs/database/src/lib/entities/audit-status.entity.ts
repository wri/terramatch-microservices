import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, ENUM, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { User } from "./user.entity";

@Table({
  tableName: "audit_statuses",
  underscored: true,
  paranoid: true,
  // @Index doesn't work with underscored column names in all contexts
  indexes: [{ name: "audit_statuses_auditable_type_auditable_id_index", fields: ["auditable_type", "auditable_id"] }]
})
export class AuditStatus extends Model<AuditStatus> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  status: string;

  @AllowNull
  @Column(TEXT)
  comment: string;

  @AllowNull
  @Column(STRING)
  firstName: string;

  @AllowNull
  @Column(STRING)
  lastName: string;

  @AllowNull
  @Column({
    type: ENUM,
    values: ["change-request", "status", "submission", "comment", "change-request-updated", "reminder-sent"]
  })
  type: string;

  @AllowNull
  @Column(BOOLEAN)
  isSubmitted: boolean;

  @AllowNull
  @Column(BOOLEAN)
  isActive: boolean;

  @AllowNull
  @Column(BOOLEAN)
  requestRemoved: boolean;

  /** @deprecated */
  @AllowNull
  @Column(DATE)
  dateCreated: Date;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;

  @Column(STRING)
  auditableType: string;

  @Column(BIGINT.UNSIGNED)
  auditableId: number;
}
