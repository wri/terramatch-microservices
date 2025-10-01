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
import { BIGINT, INTEGER, STRING, TINYINT, UUID, UUIDV4 } from "sequelize";
import { Form } from "./form.entity";

@Table({ tableName: "form_sections", underscored: true, paranoid: true })
export class FormSection extends Model<FormSection> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormSection";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(TINYINT.UNSIGNED)
  order: number;

  @Column(UUID)
  formId: string;

  @BelongsTo(() => Form, { foreignKey: "formId", targetKey: "uuid", constraints: false })
  form: Form | null;

  @AllowNull
  @Column(STRING)
  title: string | null;

  @AllowNull
  @Column(INTEGER)
  titleId: number | null;

  @AllowNull
  @Column(STRING)
  subtitle: string | null;

  @AllowNull
  @Column(STRING)
  subtitleId: string | null;

  @AllowNull
  @Column(STRING)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  descriptionId: number | null;
}
