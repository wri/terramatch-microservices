import { AllowNull, AutoIncrement, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, CreationOptional, InferAttributes, InferCreationAttributes, STRING } from "sequelize";
import { User } from "./user.entity";
import { Project } from "./project.entity";
import { EventCategory } from "../constants/product-events";

@Table({ tableName: "notifications", underscored: true })
export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number | null;

  @AllowNull
  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare createdBy: number | null;

  @AllowNull
  @Column(STRING)
  declare summary: string | null;

  @Column(STRING)
  declare category: EventCategory;

  @AllowNull
  @Column(STRING)
  declare referencedModel: string | null;

  @AllowNull
  @Column(BIGINT.UNSIGNED)
  declare referencedModelId: number | null;

  @Column({ type: BOOLEAN, defaultValue: true })
  declare unread: CreationOptional<boolean>;
}
