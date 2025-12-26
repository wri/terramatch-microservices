import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, CreationOptional, InferAttributes, InferCreationAttributes, STRING, TEXT } from "sequelize";
import { User } from "./user.entity";

@Table({ tableName: "notifications", underscored: true })
export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  userId: number;

  @Column(STRING)
  title: string;

  @Column(TEXT({ length: "long" }))
  body: string;

  @AllowNull
  @Column(STRING)
  action: string | null;

  @AllowNull
  @Column(STRING)
  referencedModel: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  referencedModelId: number | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  unread: CreationOptional<boolean>;

  @Column({ type: BOOLEAN, defaultValue: false })
  hiddenFromApp: CreationOptional<boolean>;
}
