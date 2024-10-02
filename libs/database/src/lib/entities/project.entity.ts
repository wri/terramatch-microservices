import { Column, Model, Table } from 'sequelize-typescript';

// A quick stub to get The information needed for users/me
@Table({ tableName: 'v2_projects', underscored: true })
export class Project extends Model {
  @Column
  frameworkKey: string;
}
