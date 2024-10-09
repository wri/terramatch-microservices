import { AutoIncrement, Column, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { BIGINT, STRING } from 'sequelize';

// A quick stub to get The information needed for users/me
@Table({ tableName: 'v2_projects', underscored: true })
export class Project extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Column(STRING)
  frameworkKey: string;
}
