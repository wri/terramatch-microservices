import { AllowNull, AutoIncrement, Column, Default, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, JSON, STRING, UUID } from "sequelize";

@Table({ tableName: "delayed_jobs", underscored: true })
export class DelayedJob extends Model<DelayedJob> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Default("pending")
  @Column(STRING)
  status: string;

  @AllowNull
  @Column(INTEGER({ length: 11 }))
  statusCode: number | null;

  @AllowNull
  @Column(JSON)
  payload: object | null;

  @AllowNull
  @Column(INTEGER)
  total_content: number | null;

  @AllowNull
  @Column(INTEGER)
  processed_content: number | null;

  @AllowNull
  @Column(STRING)
  proccess_message: string | null
}
