import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, INTEGER, STRING, TEXT, UUID, UUIDV4 } from "sequelize";
import { FrameworkKey } from "../constants";
import { Stage } from "./stage.entity";

@Table({ tableName: "forms", underscored: true, paranoid: true })
export class Form extends Model<Form> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\Form";

  static readonly MEDIA = {
    banner: { dbCollection: "banner", multiple: false, validation: "cover-image-with-svg" },
    document: { dbCollection: "document", multiple: false, validation: "general-documents" }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(STRING)
  frameworkKey: FrameworkKey | null;

  // TODO: type correctly model when forms are implemented on v3
  @AllowNull
  @Column(STRING)
  model: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  override version: number;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @Column(TEXT)
  title: string;

  @AllowNull
  @Column(INTEGER)
  titleId: number | null;

  @AllowNull
  @Column(TEXT)
  subtitle: string | null;

  @AllowNull
  @Column(INTEGER)
  subtitleId: number | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  descriptionId: number | null;

  @AllowNull
  @Column(TEXT)
  documentation: string | null;

  @AllowNull
  @Column(TEXT)
  submissionMessage: string | null;

  @AllowNull
  @Column(INTEGER)
  submissionMessageId: number | null;

  @AllowNull
  @Column(TEXT)
  duration: string | null;

  @Column(BOOLEAN)
  published: boolean;

  @AllowNull
  @Column(UUID)
  stageId: string | null;

  @BelongsTo(() => Stage, { foreignKey: "stageId", targetKey: "uuid", constraints: false })
  stage: Stage | null;

  @Column(STRING)
  updatedBy: string | null;

  @AllowNull
  @Column(DATE)
  deadlineAt: Date | null;

  @AllowNull
  @Column(STRING)
  documentationLabel: string | null;
}
