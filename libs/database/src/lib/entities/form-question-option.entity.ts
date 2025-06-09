import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "form_question_options", underscored: true, paranoid: true })
export class FormQuestionOption extends Model<FormQuestionOption> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormQuestionOption";

  static MEDIA = {
    image: { multiple: true, validation: "photos" }
  };

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  // TODO: foreign key on FormQuestion
  @Column(BIGINT.UNSIGNED)
  formQuestionId: number;

  @Column(INTEGER)
  order: number;

  @Column(STRING)
  label: string;

  @Column(STRING)
  imageUrl: string;
}
