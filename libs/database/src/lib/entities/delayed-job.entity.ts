import {
  AllowNull,
  AutoIncrement,
  Column,
  Default,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BIGINT, INTEGER, STRING, UUID } from 'sequelize';

@Table({ tableName: 'delayed_jobs', underscored: true })
export class DelayedJob extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column(UUID)
  uuid: string;

  @Default('pending')
  @Column(STRING)
  status: string;

  // TODO this will be changed to camel_case in the DB
  @AllowNull
  @Column({ type: INTEGER({ length: 11 }), field: 'statusCode' })
  statusCode: number | null;

  // TODO this will get updated to a json type
  @AllowNull
  @Column(STRING)
  payload: string | null;
}
