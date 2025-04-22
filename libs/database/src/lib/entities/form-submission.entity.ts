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
import { BIGINT, CHAR, STRING, UUID, UUIDV4 } from "sequelize";
import { Application } from "./application.entity";
import { FormSubmissionStatus } from "../constants/status";

// Incomplete stub
@Table({ tableName: "form_submissions", underscored: true, paranoid: true })
export class FormSubmission extends Model<FormSubmission> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(STRING)
  status: FormSubmissionStatus;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  applicationId: number | null;

  @BelongsTo(() => Application)
  application: Application | null;

  @AllowNull
  @Column(CHAR(36))
  projectPitchUuid: string | null;
}
