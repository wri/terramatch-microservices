import { AutoIncrement, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, BOOLEAN, CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { DatabaseModule } from "../database.module";

const userTaskUpdatedHook = async (userTask: UserTask) => {
  await DatabaseModule.emitUserDataModelUpdated({
    userIds: [userTask.userId],
    model: "tasks",
    modelId: userTask.taskId
  });
};

const userTaskDestroyedHook = async (userTask: UserTask) => {
  await DatabaseModule.emitUserDataModelDeleted({
    userIds: [userTask.userId],
    model: "tasks",
    modelId: userTask.taskId
  });
};

@Table({
  tableName: "user_tasks",
  underscored: true,
  paranoid: true,
  hooks: {
    afterCreate: userTaskUpdatedHook,
    afterUpdate: userTaskUpdatedHook,
    afterDestroy: userTaskDestroyedHook
  }
})
export class UserTask extends Model<InferAttributes<UserTask>, InferCreationAttributes<UserTask>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @BelongsTo(() => User, { constraints: false })
  declare user: User | null;

  get userUuid(): string | null | undefined {
    return this.user?.uuid;
  }

  get firstName() {
    return this.user?.firstName;
  }

  get lastName() {
    return this.user?.lastName;
  }

  @ForeignKey(() => Task)
  @Column(BIGINT.UNSIGNED)
  declare taskId: number;

  @BelongsTo(() => Task, { constraints: false })
  declare task: Task | null;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare assigned: boolean;

  @Column({ type: BOOLEAN, defaultValue: false })
  declare read: boolean;
}
