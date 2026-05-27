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
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Column(BIGINT.UNSIGNED)
  declare formOptionListId: number;

  @BelongsTo(() => FormOptionList, { foreignKey: "formOptionListId", constraints: false })
  declare formOptionList: FormOptionList | null;

  @AllowNull
  @Column(STRING)
  declare slug: string | null;

  @AllowNull
  @Column(STRING)
  declare altValue: string | null;

  @AllowNull
  @Column(STRING)
  declare label: string | null;

  @AllowNull
  @Column(INTEGER)
  declare labelId: number | null;

  @BelongsTo(() => I18nItem, { foreignKey: "labelId", constraints: false })
  declare labelTranslated: I18nItem | null;

  @AllowNull
  @Column(STRING)
  declare imageUrl: string | null;
}
