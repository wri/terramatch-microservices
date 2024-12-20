import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT } from "sequelize";

// A quick stub for the research endpoints
@Table({ tableName: "v2_sites", underscored: true, paranoid: true })
export class SiteName extends Model<SiteName> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column
  name: string;
}
