import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Role } from './role.entity';

@Table({ tableName: 'model_has_roles', underscored: true, timestamps: false })
export class ModelHasRole extends Model {
  @ForeignKey(() => Role)
  @Column({ primaryKey: true })
  roleId: bigint;

  @Column({ primaryKey: true })
  modelType: string;

  @Column({ primaryKey: true })
  modelId: bigint;
}
