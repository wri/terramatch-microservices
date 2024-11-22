import { Column, ForeignKey, Model, Table } from "sequelize-typescript";
import { Role } from "./role.entity";
import { BIGINT, STRING } from "sequelize";

@Table({ tableName: "model_has_roles", underscored: true, timestamps: false })
export class ModelHasRole extends Model<ModelHasRole> {
  @ForeignKey(() => Role)
  @Column({ type: BIGINT.UNSIGNED, primaryKey: true })
  roleId: number;

  @Column({ type: STRING, primaryKey: true })
  modelType: string;

  @Column({ type: BIGINT.UNSIGNED, primaryKey: true })
  modelId: number;
}
