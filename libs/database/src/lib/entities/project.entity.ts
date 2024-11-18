import { AutoIncrement, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, STRING } from "sequelize";

// A quick stub to get the information needed for users/me
@Table({ tableName: "v2_projects", underscored: true, paranoid: true })
export class Project extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  frameworkKey: string;

  @Default(false)
  @Column(BOOLEAN)
  isTest: boolean;
}
