import { AutoIncrement, Column, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { BIGINT } from 'sequelize';

// A quick stub to get The information needed for users/me
@Table({ tableName: 'v2_projects', underscored: true })
export class Project extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT.UNSIGNED })
  override id: number;

  @Column
  frameworkKey: string;
}
