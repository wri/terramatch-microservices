import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { FormQuestion } from "./form-question.entity";

@Table({ tableName: "form_question_options", underscored: true, paranoid: true })
export class FormQuestionOption extends Model<FormQuestionOption> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormQuestionOption";

  static readonly MEDIA = {
    image: { dbCollection: "image", multiple: false, validation: "photos" }
  } as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(BIGINT.UNSIGNED)
  formQuestionId: number;

  @BelongsTo(() => FormQuestion, { foreignKey: "formQuestionId", constraints: false })
  formQuestion: FormQuestion | null;

  @AllowNull
  @Column(STRING)
  slug: string | null;

  @Column(STRING)
  label: string;

  @AllowNull
  @Column(INTEGER)
  labelId: number | null;

  @Column(INTEGER)
  order: number;

  @AllowNull
  @Column(STRING)
  imageUrl: string | null;

  @AllowNull
  @Column(INTEGER)
  formOptionListOptionId: number | null;
}
