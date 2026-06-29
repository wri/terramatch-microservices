import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  HasMany,
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
import { Literal } from "sequelize/types/utils";
import { removeQuestionDependencies } from "../hooks/remove-question-dependencies";
import { FormQuestionOption } from "./form-question-option.entity";

@Scopes(() => ({
  form: (formUuid: string | Literal) => ({ where: { formSectionId: { [Op.in]: FormSection.forForm(formUuid) } } })
}))
@Table({
  tableName: "form_questions",
  underscored: true,
  paranoid: true,
  hooks: {
    async afterDestroy(question: FormQuestion) {
      const childIds = (await FormQuestion.findAll({ where: { parentId: question.id }, attributes: ["id"] })).map(
        ({ id }) => id
      );
      await removeQuestionDependencies([question.id, ...childIds]);
    }
  }
})
export class FormQuestion extends Model<FormQuestion> {
  static readonly I18N_FIELDS = ["label", "description", "placeholder"] as const;

  static forForm(formUuid: string | Literal) {
    return chainScope(this, "form", formUuid) as typeof FormQuestion;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @ForeignKey(() => FormSection)
  @Column(BIGINT.UNSIGNED)
  declare formSectionId: number;

  @BelongsTo(() => FormSection)
  declare formSection: FormSection | null;

  @AllowNull
  @Column(UUID)
  declare parentId: string | null;

  @BelongsTo(() => FormQuestion, { foreignKey: "parentId", targetKey: "uuid", constraints: false })
  declare parent: FormQuestion | null;

  @AllowNull
  @Column(STRING)
  declare linkedFieldKey: string | null;

  @Column(STRING)
  declare inputType: InputType;

  @AllowNull
  @Column(STRING)
  declare name: string | null;

  get formName(): string {
    return this.name ?? this.uuid;
  }

  @Column(TEXT)
  declare label: string;

  @AllowNull
  @Column(INTEGER)
  declare labelId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "label_id", constraints: false })
  declare labelI18nItem: I18nItem | null;

  @AllowNull
  @Column(TEXT)
  declare description: string | null;

  @AllowNull
  @Column(INTEGER)
  declare descriptionId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "description_id", constraints: false })
  declare descriptionI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  declare placeholder: string | null;

  @AllowNull
  @Column(INTEGER)
  declare placeholderId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "placeholder_id", constraints: false })
  declare placeholderI18nItem: I18nItem | null;

  @AllowNull
  @Column(STRING)
  declare optionsList: string | null;

  @Column({ type: BOOLEAN, field: "multichoice", defaultValue: false })
  declare multiChoice: boolean;

  @AllowNull
  @Column(STRING)
  declare collection: string | null;

  @Column(TINYINT)
  declare order: number;

  @AllowNull
  @JsonColumn()
  declare additionalProps: object | null;

  @AllowNull
  @Column(TEXT("tiny"))
  declare additionalText: string | null;

  @AllowNull
  @Column(STRING)
  declare additionalUrl: string | null;

  @AllowNull
  @Column(BOOLEAN)
  declare showOnParentCondition: boolean | null;

  @AllowNull
  @JsonColumn()
  declare validation: object | null;

  @AllowNull
  @Column({ type: BOOLEAN, defaultValue: false })
  declare optionsOther: boolean | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  declare conditionalDefault: boolean;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare isParentConditionalDefault: boolean;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, defaultValue: 0 })
  declare minCharacterLimit: number | null;

  @AllowNull
  @Column({ type: INTEGER.UNSIGNED, defaultValue: 90000 })
  declare maxCharacterLimit: number | null;

  @AllowNull
  @JsonColumn()
  declare years: number[] | null;

  @HasMany(() => FormQuestionOption)
  declare options: FormQuestionOption[] | null;

  /**
   * Returns true if this question is hidden based on the parent conditional's answer
   */
  isHidden(answers: Dictionary<unknown>, formQuestions: FormQuestion[]) {
    const parent = this.parentId == null ? undefined : formQuestions.find(({ uuid }) => uuid == this.parentId);
    if (parent == null || parent.inputType !== "conditional" || this.showOnParentCondition == null) return false;

    return (answers[parent.uuid] ?? false) !== this.showOnParentCondition;
  }
}
