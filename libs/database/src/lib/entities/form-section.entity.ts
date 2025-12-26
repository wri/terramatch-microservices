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
import { FormQuestion } from "./form-question.entity";
import { Subquery } from "../util/subquery.builder";

@Table({
  tableName: "form_sections",
  underscored: true,
  paranoid: true,
  hooks: {
    async beforeDestroy(section: FormSection) {
      // Deleting the form questions attached to this section will also remove all the child questions,
      // so prevent an N+1 query by forcing hooks off.
      await FormQuestion.destroy({ where: { formSectionId: section.id }, hooks: false });
    }
  }
})
export class FormSection extends Model<FormSection> {
  static readonly LARAVEL_TYPE = "App\\Models\\V2\\Forms\\FormSection";

  static readonly I18N_FIELDS = ["title", "subtitle", "description"] as const;

  static forForm(formUuid: string) {
    return Subquery.select(FormSection, "id").eq("formId", formUuid).literal;
  }

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
