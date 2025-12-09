import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, ENUM, NOW, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { User } from "./user.entity";

const TYPES = ["created", "deleted", "restored", "update", "updated"] as const;
type AuditType = (typeof TYPES)[number];

@Table({
  tableName: "audits",
  underscored: true
})
export class Audit extends Model<Audit> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @AllowNull
  @Column({ type: ENUM, values: TYPES })
  event: string | null;

  @AllowNull
  @Column(STRING)
  status: string | null;

  @AllowNull
  @Column(TEXT)
  oldValues: string | null;

  @AllowNull
  @Column(TEXT)
  newValues: string | null;

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
  type: AuditType | null;

  @AllowNull
  @Column(BOOLEAN)
  isSubmitted: boolean | null;

  @AllowNull
  @Column(BOOLEAN)
  isActive: boolean | null;

  @AllowNull
  @Column(BOOLEAN)
  requestRemoved: boolean | null;

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
