import { AutoIncrement, Column, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, UUID } from "sequelize";

// A quick stub for the research endpoints
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class Site extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;
}
