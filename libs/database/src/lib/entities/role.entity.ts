import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";

@Table({ tableName: "roles", underscored: true })
export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @Column(STRING)
  name: string;

  @Column({ type: STRING, defaultValue: "api" })
  guardName: CreationOptional<string>;
}
