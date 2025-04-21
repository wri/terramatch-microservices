import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, STRING, UUID, UUIDV4 } from "sequelize";

// Incomplete stub
@Table({ tableName: "frameworks", underscored: true })
export class Framework extends Model<Framework> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @Index
  @Column(STRING(20))
  slug: string;

  @Column(STRING)
  name: string;
}
