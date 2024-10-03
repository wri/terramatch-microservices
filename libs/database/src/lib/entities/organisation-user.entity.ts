import { AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { BIGINT, STRING } from 'sequelize';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

@Table({ tableName: 'organisation_user', underscored: true, timestamps: false })
export class OrganisationUser extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: BIGINT({ unsigned: true }) })
  override id: bigint;

  @ForeignKey(() => User)
  @Column
  userId: bigint;

  @ForeignKey(() => Organisation)
  @Column
  organisationId: bigint;

  @Column({ type: STRING(20) })
  status: string;
}
