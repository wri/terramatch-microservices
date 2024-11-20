import { AutoIncrement, Column, Default, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING, UUID } from "sequelize";

// A quick stub to get the information needed for users/me
@Table({ tableName: "v2_projects", underscored: true, paranoid: true })
export class Project extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Column(STRING)
  frameworkKey: string;

  @Default(false)
  @Column(BOOLEAN)
  isTest: boolean;
}
