import { AllowNull, AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, INTEGER, STRING, TINYINT, UUID, UUIDV4 } from "sequelize";

@Table({ tableName: "v2_stratas", underscored: true, paranoid: true })
export class Strata extends Model<Strata> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column(INTEGER.UNSIGNED)
  ownerId: number | null;

  @Column(STRING)
  stratasableType: string;

  @Column(BIGINT.UNSIGNED)
  stratasableId: number;

  @AllowNull
  @Column(STRING)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  extent: string | null;

  @Column(TINYINT)
  hidden: number | null;
}
