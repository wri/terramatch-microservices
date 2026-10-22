import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import {
  BIGINT,
  BOOLEAN,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  STRING,
  UUID,
  UUIDV4
} from "sequelize";
import { User } from "./user.entity";
import { Project } from "./project.entity";
import { EventCategory } from "../constants/product-events";
import { DatabaseModule } from "../database.module";

const notificationUpdatedHook = async (notification: Notification) => {
  await DatabaseModule.emitUserDataModelUpdated({
    userIds: [notification.userId],
    model: "notifications",
    modelId: notification.id
  });
};

const notificationDestroyedHook = async (notification: Notification) => {
  await DatabaseModule.emitUserDataModelDeleted({
    userIds: [notification.userId],
    model: "notifications",
    uuid: notification.uuid
  });
};

@Table({
  tableName: "notifications",
  underscored: true,
  hooks: {
    afterCreate: notificationUpdatedHook,
    afterUpdate: notificationUpdatedHook,
    afterDestroy: notificationDestroyedHook
  }
})
export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  declare id: CreationOptional<number>;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  declare uuid: CreationOptional<string>;

  @ForeignKey(() => User)
  @Column(BIGINT.UNSIGNED)
  declare userId: number;

  @AllowNull
  @ForeignKey(() => Project)
  @Column(BIGINT.UNSIGNED)
  declare projectId: number | null;

  @BelongsTo(() => Project, { constraints: false })
  declare project: Project | null;

  get projectUuid(): string | undefined {
    return this.project?.uuid;
  }

  get projectName() {
    return this.project?.name;
  }

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
