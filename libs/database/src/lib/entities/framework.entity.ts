import { AutoIncrement, Column, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { BIGINT, STRING } from 'sequelize';

// A quick stub to get the information needed for users/me
@Table({ tableName: 'frameworks', underscored: true })
export class Framework extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT({ unsigned: true }) })
  override id: bigint;

  @Column({ type: STRING(20) })
  slug: string;

  @Column
  name: string;
}
