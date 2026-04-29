import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { FormQuestion } from "./form-question.entity";
import { MediaConfiguration } from "../constants/media-owners";
import { removeMedia } from "../hooks/remove-media";
import { isEmpty, kebabCase } from "lodash";

type FormQuestionOptionMedia = "image";

const generateSlug = async (label: string, formQuestionId: number) => {
  for (let ii = 0; ; ii++) {
    const slug = `${kebabCase(label)}${ii === 0 ? "" : `_${ii}`}`;
    if ((await FormQuestionOption.count({ where: { formQuestionId, slug } })) === 0) return slug;
  }
};

const generateSlugHook = async (option: FormQuestionOption) => {
  if (isEmpty(option.slug) && !isEmpty(option.label)) {
    option.slug = await generateSlug(option.label as string, option.formQuestionId);
  }
};

@Table({
  tableName: "form_question_options",
  underscored: true,
  paranoid: true,

  hooks: {
    beforeCreate: generateSlugHook,
    beforeUpdate: generateSlugHook,
    beforeSave: generateSlugHook,
    afterDestroy: removeMedia
  }
})
export class FormQuestionOption extends Model<FormQuestionOption> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormQuestionOption";

  static readonly MEDIA: Record<FormQuestionOptionMedia, MediaConfiguration> = {
    image: { dbCollection: "image", multiple: false, validation: "photos" }
  };

  static readonly I18N_FIELDS = ["label"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => FormQuestion)
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
