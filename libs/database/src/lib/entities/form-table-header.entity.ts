import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
  Unique
} from "sequelize-typescript";
import { BIGINT, INTEGER, SMALLINT, STRING, UUID, UUIDV4 } from "sequelize";
import { FormQuestion } from "./form-question.entity";

@Table({ tableName: "form_table_headers", underscored: true, paranoid: true })
export class FormTableHeader extends Model<FormTableHeader> {
  static readonly I18N_FIELDS = ["label"] as const;

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Unique
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @ForeignKey(() => FormQuestion)
  @Column(BIGINT.UNSIGNED)
  formQuestionId: number;

  @AllowNull
  @Column(STRING)
  slug: string | null;

  @AllowNull
  @Column(STRING)
  label: string | null;

  @AllowNull
  @Column(INTEGER)
  labelId: number | null;

  @AllowNull
  @Column(SMALLINT)
  order: number | null;
}
