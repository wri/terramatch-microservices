import { Column, Model, Table } from 'sequelize-typescript';
import { STRING } from 'sequelize';

// A quick stub to get the information needed for users/me
@Table({ tableName: 'frameworks', underscored: true })
export class Framework extends Model {
  @Column({ type: STRING(20) })
  slug: string;

  @Column
  name: string;
}
