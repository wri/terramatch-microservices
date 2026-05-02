import { Column, ForeignKey, Model, Table } from "sequelize-typescript";
import { Role } from "./role.entity";
import { BIGINT, InferAttributes, InferCreationAttributes, STRING } from "sequelize";

@Table({ tableName: "model_has_roles", underscored: true, timestamps: false })
export class ModelHasRole extends Model<InferAttributes<ModelHasRole>, InferCreationAttributes<ModelHasRole>> {
  @ForeignKey(() => Role)
  @Column({ type: BIGINT.UNSIGNED, primaryKey: true })
  roleId: number;

  @Column({ type: STRING, primaryKey: true })
  modelType: string;

  @Column({ type: BIGINT.UNSIGNED, primaryKey: true })
  modelId: number;
}
