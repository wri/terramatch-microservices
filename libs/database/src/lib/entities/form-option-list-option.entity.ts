import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { FormOptionList } from "./form-option-list.entity";
import { I18nItem } from "./i18n-item.entity";

@Table({ tableName: "form_option_list_options", underscored: true, paranoid: true })
export class FormOptionListOption extends Model<FormOptionListOption> {
  static readonly I18N_FIELDS = ["label"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(BIGINT.UNSIGNED)
  formOptionListId: number;

  @BelongsTo(() => FormOptionList, { foreignKey: "formOptionListId", constraints: false })
  formOptionList: FormOptionList | null;

  @AllowNull
  @Column(STRING)
  slug: string | null;

  @AllowNull
  @Column(STRING)
  altValue: string | null;

  @AllowNull
  @Column(STRING)
  label: string | null;

  @AllowNull
  @Column(INTEGER)
  labelId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "labelId", constraints: false })
  labelTranslated: I18nItem | null;

  @AllowNull
  @Column(STRING)
  imageUrl: string | null;
}
