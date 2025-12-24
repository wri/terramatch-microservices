import { Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, InferAttributes, InferCreationAttributes } from "sequelize";

@Table({ tableName: "role_has_permissions", underscored: true, timestamps: false })
export class RoleHasPermission extends Model<
  InferAttributes<RoleHasPermission>,
  InferCreationAttributes<RoleHasPermission>
> {
  @PrimaryKey
  @Column(BIGINT.UNSIGNED)
  roleId!: number;

  @PrimaryKey
  @Column(BIGINT.UNSIGNED)
  permissionId!: number;
}
