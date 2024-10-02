import { Column, Model, Table } from 'sequelize-typescript';
import { STRING } from 'sequelize';

// A quick stub to get access to a query builder for this table.
@Table({ tableName: 'frameworks' })
export class Framework extends Model {
  @Column({ type: STRING(20) })
  slug: string;

  @Column
  name: string;
}
