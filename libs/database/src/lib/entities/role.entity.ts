import {
  AutoIncrement,
  Column,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BIGINT } from 'sequelize';

@Table({ tableName: 'roles', underscored: true })
export class Role extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT.UNSIGNED })
  override id: number;

  @Column
  name: string;

  @Column
  guardName: string;
}
