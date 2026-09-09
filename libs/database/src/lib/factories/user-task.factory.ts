import { FactoryGirl } from "factory-girl-ts";
import { UserTask } from "../entities";
import { UserFactory } from "./user.factory";
import { TaskFactory } from "./task.factory";

export const UserTaskFactory = FactoryGirl.define(UserTask, async () => ({
  userId: UserFactory.associate("id"),
  taskId: TaskFactory.associate("id")
}));
