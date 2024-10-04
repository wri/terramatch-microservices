import { Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Role } from './role.entity';
import { BIGINT } from 'sequelize';

@Table({ tableName: 'model_has_roles', underscored: true, timestamps: false })
export class ModelHasRole extends Model {
  @ForeignKey(() => Role)
  @Column({ type: BIGINT.UNSIGNED, primaryKey: true })
  roleId: number;

  @Column({ primaryKey: true })
  modelType: string;

  @Column({ primaryKey: true })
  modelId: bigint;
}
