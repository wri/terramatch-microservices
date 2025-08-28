import { AutoIncrement, Column, Index, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "form_option_lists", underscored: true, paranoid: true })
export class FormOptionList extends Model<FormOptionList> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Unique
  @Column(STRING)
  key: string;
}
