import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUIDV4, UUID, STRING, TEXT } from "sequelize";

@Table({ tableName: "failed_jobs", underscored: true, timestamps: false })
export class FailedJob extends Model<FailedJob> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @AllowNull
  @Column(STRING)
  declare connection: string | null;

  @AllowNull
  @Column(STRING)
  declare queue: string | null;

  @AllowNull
  @Column(TEXT)
  declare payload: string | null;

  @AllowNull
  @Column(TEXT)
  declare exception: string | null;

  @AllowNull
  @Column(TEXT)
  declare failedAt: string | null;
}
