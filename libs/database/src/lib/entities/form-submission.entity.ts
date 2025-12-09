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
import {
  BIGINT,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  TEXT,
  UUID,
  UUIDV4
} from "sequelize";
import { Application } from "./application.entity";
import { FormSubmissionStatus } from "../constants/status";
import { ProjectPitch } from "./project-pitch.entity";
import { User } from "./user.entity";
import { Form } from "./form.entity";
import { Stage } from "./stage.entity";
import { Organisation } from "./organisation.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { Dictionary } from "lodash";

@Table({ tableName: "form_submissions", underscored: true, paranoid: true })
export class FormSubmission extends Model<InferAttributes<FormSubmission>, InferCreationAttributes<FormSubmission>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: CreationOptional<string>;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  @Column(STRING)
  status: FormSubmissionStatus;

  @JsonColumn()
  answers: Dictionary<unknown>;

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

  get applicationUuid(): string | null {
    return this.application?.uuid ?? null;
  }

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

  get formUuid(): string | null {
    return this.form?.uuid ?? null;
  }

  @AllowNull
  @Column(UUID)
  stageUuid: string | null;

  @BelongsTo(() => Stage, { foreignKey: "stageUuid", targetKey: "uuid", constraints: false })
  stage: Stage | null;

  get stageName(): string | null {
    return this.stage?.name ?? null;
  }

  @AllowNull
  @Column(UUID)
  organisationUuid: string | null;

  @BelongsTo(() => Organisation, { foreignKey: "organisationUuid", targetKey: "uuid", constraints: false })
  organisation: Organisation | null;

  get organisationName(): string | null {
    return this.organisation?.name ?? null;
  }
}
