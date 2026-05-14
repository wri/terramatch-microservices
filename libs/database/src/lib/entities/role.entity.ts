import { AutoIncrement, Column, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";

@Table({ tableName: "roles", underscored: true })
export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Column(STRING)
  declare name: string;

  @Column({ type: STRING, defaultValue: "api" })
  declare guardName: CreationOptional<string>;
}
