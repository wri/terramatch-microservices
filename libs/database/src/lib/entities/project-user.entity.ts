import {
  AllowNull,
  AutoIncrement,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { Project } from './project.entity';
import { User } from './user.entity';
import { BIGINT } from 'sequelize';

@Table({ tableName: 'v2_project_users', underscored: true })
export class ProjectUser extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT.UNSIGNED })
  override id: number;

  @ForeignKey(() => Project)
  @Column({ type: BIGINT.UNSIGNED })
  projectId: number;

  @ForeignKey(() => User)
  @Column({ type: BIGINT.UNSIGNED })
  userId: number;

  @AllowNull
  @Column
  status: string;

  @Column({ defaultValue: false })
  isMonitoring: boolean;

  @Column({ defaultValue: false })
  isManaging: boolean;
}
