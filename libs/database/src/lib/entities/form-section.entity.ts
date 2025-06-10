import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CHAR, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { Form } from "./form.entity";

@Table({ tableName: "form_sections", underscored: true, paranoid: true })
export class FormSection extends Model<FormSection> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormSection";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(INTEGER)
  order: number;

  @AllowNull
  @ForeignKey(() => Form)
  @Column(CHAR(36))
  formId: string | null;

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
  @Column(INTEGER)
  subtitleId: number | null;

  @AllowNull
  @Column(STRING)
  description: string | null;

  @AllowNull
  @Column(STRING)
  descriptionId: number | null;
}
