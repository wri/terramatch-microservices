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
import { BIGINT, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { Application } from "./application.entity";
import { FormSubmissionStatus } from "../constants/status";
import { ProjectPitch } from "./project-pitch.entity";
import { User } from "./user.entity";
import { Form } from "./form.entity";
import { Stage } from "./stage.entity";
import { Organisation } from "./organisation.entity";
import { JsonColumn } from "../decorators/json-column.decorator";

@Table({ tableName: "form_submissions", underscored: true, paranoid: true })
export class FormSubmission extends Model<FormSubmission> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  @Column(STRING)
  status: FormSubmissionStatus;

  @JsonColumn()
  answers: object;

  @AllowNull
  @Column(TEXT)
  feedback: string | null;

  @AllowNull
  @JsonColumn()
  feedbackFields: string[] | null;

  @AllowNull
  @ForeignKey(() => Application)
  @Column(BIGINT.UNSIGNED)
  applicationId: number | null;

  @BelongsTo(() => Application)
  application: Application | null;

  @AllowNull
  @Column(UUID)
  projectPitchUuid: string | null;

  @BelongsTo(() => ProjectPitch, { foreignKey: "projectPitchUuid", targetKey: "uuid", constraints: false })
  projectPitch: ProjectPitch | null;

  @AllowNull
  @Column(UUID)
  userId: string | null;

  @BelongsTo(() => User, { foreignKey: "userId", targetKey: "uuid", constraints: false })
  user: User | null;

  @AllowNull
  @Column(UUID)
  formId: string | null;

  @BelongsTo(() => Form, { foreignKey: "formId", targetKey: "uuid", constraints: false })
  form: Form | null;

  @AllowNull
  @Column(UUID)
  stageUuid: string | null;

  @BelongsTo(() => Stage, { foreignKey: "stageUuid", targetKey: "uuid", constraints: false })
  stage: Stage | null;

  @AllowNull
  @Column(UUID)
  organisationUuid: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationUuid", targetKey: "uuid", constraints: false })
  organisation: Organisation | null;
}
