import { AutoIncrement, Column, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";
import { BIGINT, STRING, UUID } from "sequelize";

// Incomplete stub
@Table({ tableName: "funding_programmes", underscored: true, paranoid: true })
export class FundingProgramme extends Model<FundingProgramme> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Unique
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  name: string;
}
