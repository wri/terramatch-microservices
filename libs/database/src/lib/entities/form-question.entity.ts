import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, BOOLEAN, INTEGER, Op, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";
import { I18nItem } from "./i18n-item.entity";
import { JsonColumn } from "../decorators/json-column.decorator";
import { FormSection } from "./form-section.entity";
import { InputType } from "../constants/linked-fields";
import { Dictionary } from "lodash";
import { chainScope } from "../util/chain-scope";

@Scopes(() => ({
  form: (formUuid: string) => ({ where: { formSectionId: { [Op.in]: FormSection.forForm(formUuid) } } })
}))
@Table({
  tableName: "form_questions",
  underscored: true,
  paranoid: true,
  hooks: {
    async beforeDestroy(question: FormQuestion) {
      // Child questions cannot themselves have children, so avoid N+1 query by forcing hooks off
      await FormQuestion.destroy({ where: { parentId: question.id }, hooks: false });
    }
  }
})
export class FormQuestion extends Model<FormQuestion> {
  static forForm(formUuid: string) {
    return chainScope(this, "form", formUuid) as typeof FormQuestion;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => FormSection)
  @Column(BIGINT.UNSIGNED)
  formSectionId: number;

  @BelongsTo(() => FormSection)
  formSection: FormSection | null;

  @AllowNull
  @Column(UUID)
  parentId: string | null;

  @BelongsTo(() => FormQuestion, { foreignKey: "parentId", targetKey: "uuid", constraints: false })
  parent: FormQuestion | null;

  @AllowNull
  @Column(STRING)
  linkedFieldKey: string | null;

  @Column(STRING)
  inputType: InputType;

  @AllowNull
  @Column(STRING)
  name: string | null;

  @Column(TEXT)
  label: string;

  @AllowNull
  @Column(INTEGER)
  labelId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "label_id", constraints: false })
  labelI18nItem: I18nItem | null;

  @AllowNull
  @Column(TEXT)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  descriptionId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "description_id", constraints: false })
  descriptionI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  placeholder: string | null;

  @AllowNull
  @Column(INTEGER)
  placeholderId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "placeholder_id", constraints: false })
  placeholderI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  optionsList: string | null;

  @Column({ type: BOOLEAN, field: "multichoice", defaultValue: false })
  multiChoice: boolean;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @Column(TINYINT)
  order: number;

  @AllowNull
  @JsonColumn()
  additionalProps: object | null;

  @AllowNull
  @Column(TEXT("tiny"))
  additionalText: string | null;

  @AllowNull
  @Column(STRING)
  additionalUrl: string | null;

  @AllowNull
  @Column(BOOLEAN)
  showOnParentCondition: boolean | null;

  @AllowNull
  @JsonColumn()
  validation: object | null;

  @AllowNull
  @Column({ type: BOOLEAN, defaultValue: false })
  optionsOther: boolean | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  conditionalDefault: boolean;

  @Column({ type: BOOLEAN, defaultValue: false })
  isParentConditionalDefault: boolean;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  minCharacterLimit: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, defaultValue: 90000 })
  maxCharacterLimit: number | null;

  @AllowNull
  @JsonColumn()
  years: number[] | null;

  /**
   * Returns true if this question is hidden based on the parent conditional's answer
   */
  isHidden(answers: Dictionary<unknown>, formQuestions: FormQuestion[]) {
    const parent = this.parentId == null ? undefined : formQuestions.find(({ uuid }) => uuid == this.parentId);
    if (parent == null || parent.inputType !== "conditional" || this.showOnParentCondition == null) return false;

    return (answers[parent.uuid] ?? false) !== this.showOnParentCondition;
  }
}
