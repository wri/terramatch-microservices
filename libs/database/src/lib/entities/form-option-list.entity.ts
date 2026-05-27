import { AutoIncrement, Column, HasMany, Index, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";
import { FormOptionListOption } from "./form-option-list-option.entity";

@Table({ tableName: "form_option_lists", underscored: true, paranoid: true })
export class FormOptionList extends Model<FormOptionList> {
  static readonly I18N_FIELDS = [] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: string;

  @Unique
  @Column(STRING)
  declare key: string;

  @HasMany(() => FormOptionListOption, { foreignKey: "formOptionListId", constraints: false })
  declare listOptions: FormOptionListOption[] | null;
}
