import { AllowNull, AutoIncrement, BelongsTo, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, UUID, UUIDV4 } from "sequelize";
import { FormOptionList } from "./form-option-list.entity";
import { I18nItem } from "./i18n-item.entity";

@Table({ tableName: "form_option_list_options", underscored: true, paranoid: true })
export class FormOptionListOption extends Model<FormOptionListOption> {
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
  slug: string;

  @AllowNull
  @Column(STRING)
  altValue: string;

  @AllowNull
  @Column(STRING)
  label: string;

  @AllowNull
  @Column(INTEGER)
  labelId: number;

  @BelongsTo(() => I18nItem, { foreignKey: "labelId", constraints: false })
  labelTranslated: I18nItem | null;

  @AllowNull
  @Column(STRING)
  imageUrl: string;
}
