import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TEXT, TINYINT, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "v2_invasives", underscored: true, paranoid: true })
export class Invasive extends Model<Invasive> {
  static readonly LARAVEL_TYPE = "App\\Models\\Invasive";

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Column(STRING)
  invasiveableType: string;

  @Column(BIGINT.UNSIGNED)
  invasiveableId: number;

  @AllowNull
  @Column(STRING)
  collection: string | null;

  @AllowNull
  @Column(STRING)
  type: string | null;

  @AllowNull
  @Column(TEXT)
  name: string | null;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(INTEGER.UNSIGNED)
  oldId: number;

  /**
   * @deprecated This property is no longer in use and will be removed in future versions.
   */
  @AllowNull
  @Column(STRING)
  oldModel: string | null;

  @Column(TINYINT)
  hidden: number | null;
}
