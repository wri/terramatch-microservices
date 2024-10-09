import {
  AllowNull,
  AutoIncrement,
  Column, Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript';
import { Project } from './project.entity';
import { User } from './user.entity';
import { BIGINT, BOOLEAN, STRING } from 'sequelize';

@Table({ tableName: 'v2_project_users', underscored: true })
export class ProjectUser extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  projectId: number;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @AllowNull
  @Column(STRING)
  status: string;

  @Default(false)
  @Column(BOOLEAN)
  isMonitoring: boolean;

  @Default(false)
  @Column(BOOLEAN)
  isManaging: boolean;
}
