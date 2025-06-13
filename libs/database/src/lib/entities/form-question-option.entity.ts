import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { MediaConfiguration } from "../constants/media-owners";

@Table({ tableName: "form_question_options", underscored: true, paranoid: true })
export class FormQuestionOption extends Model<FormQuestionOption> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormQuestionOption";

  static readonly MEDIA: Record<string, MediaConfiguration> = {
    image: { dbCollection: "image", multiple: true, validation: "photos" }
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
