import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUIDV4, UUID, STRING, TEXT } from "sequelize";

@Table({ tableName: "failed_jobs", underscored: true })
export class FailedJob extends Model<FailedJob> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  connection: string | null;

  @AllowNull
  @Column(STRING)
  queue: string | null;

  @AllowNull
  @Column(TEXT)
  payload: string | null;

  @AllowNull
  @Column(TEXT)
  exception: string | null;

  @AllowNull
  @Column(TEXT)
  failedAt: string | null;
}
