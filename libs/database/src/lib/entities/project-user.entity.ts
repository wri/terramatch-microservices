import { AllowNull, Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Project } from './project.entity';
import { User } from './user.entity';

@Table({ tableName: 'v2_project_users', underscored: true })
export class ProjectUser extends Model {
  @ForeignKey(() => Project)
  @Column
  projectId: bigint;

  @ForeignKey(() => User)
  @Column
  userId: bigint;

  @AllowNull
  @Column
  status: string;

  @Column({ defaultValue: false })
  isMonitoring: boolean;

  @Column({ defaultValue: false })
  isManaging: boolean;
}
