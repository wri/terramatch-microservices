import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, STRING, UUID } from "sequelize";
import { Application } from "./application.entity";

// Incomplete stub
@Table({ tableName: "form_submissions", underscored: true, paranoid: true })
export class FormSubmission extends Model<FormSubmission> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  status: string;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  applicationId: number | null;

  @BelongsTo(() => Application)
  application: Application | null;
}
