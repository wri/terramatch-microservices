import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, CreationOptional, InferAttributes, InferCreationAttributes, STRING, TEXT } from "sequelize";
import { User } from "./user.entity";

@Table({ tableName: "notifications", underscored: true })
export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @Column(STRING)
  declare title: string;

  @Column(TEXT({ length: "long" }))
  declare body: string;

  @AllowNull
  @Column(STRING)
  declare action: string | null;

  @AllowNull
  @Column(STRING)
  declare referencedModel: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare referencedModelId: number | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  declare unread: CreationOptional<boolean>;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare hiddenFromApp: CreationOptional<boolean>;
}
