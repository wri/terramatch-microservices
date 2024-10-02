import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { STRING } from 'sequelize';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

@Table({ tableName: 'organisation_user', underscored: true, timestamps: false })
export class OrganisationUser extends Model {
  @ForeignKey(() => User)
  @Column
  userId: bigint;

  @ForeignKey(() => Organisation)
  @Column
  organisationId: bigint;

  @Column({ type: STRING(20) })
  status: string;
}
