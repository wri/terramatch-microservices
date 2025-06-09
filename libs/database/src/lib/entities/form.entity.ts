import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey } from "sequelize-typescript";
import { BIGINT, BOOLEAN, DATE, STRING, TINYINT, UUID, UUIDV4 } from "sequelize";
import { FrameworkKey } from "../constants/framework";
import { User } from "./user.entity";

export class Form extends Model<Form> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\Form";

  static readonly MEDIA = {
    banner: { validation: "cover-image-with-svg", multiple: false },
    document: { validation: "general-documents", multiple: false }
  };

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
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
  @Column(TINYINT)
  override version: number;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(STRING)
  subtitle: string | null;

  @AllowNull
  @Column(STRING)
  description: string | null;

  @AllowNull
  @Column(STRING)
  documentation: string | null;

  @AllowNull
  @Column(STRING)
  submissionMessage: string | null;

  @AllowNull
  @Column(TINYINT)
  duration: number;

  @AllowNull
  @Column(BOOLEAN)
  published: boolean | null;

  @AllowNull
  @Column(DATE)
  deadlineAt?: Date | null;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  updatedBy: number | null;
}
