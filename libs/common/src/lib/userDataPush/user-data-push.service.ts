import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { UserDataModel } from "@terramatch-microservices/database/types/user-model";

export const USER_DATA_PUSH_QUEUE = "userSocket";
export const USER_DATA_PUSH_EVENT = "userDataPush";
export const USER_DATA_DELETE_EVENT = "userDataDelete";

export type UserDataPushEvent = {
  userIds: number[];
  model: UserDataModel;
  modelId: number;
};

@Injectable()
export class UserDataPushService {
  constructor(@InjectQueue(USER_DATA_PUSH_QUEUE) private readonly userDataQueue: Queue<UserDataPushEvent>) {}

  async sendData(userIds: number[], model: UserDataModel, modelId: number) {
    await this.userDataQueue.add(USER_DATA_PUSH_EVENT, { userIds, model, modelId });
  }

  async sendDataDeletion(userIds: number[], model: UserDataModel, modelId: number) {
    await this.userDataQueue.add(USER_DATA_DELETE_EVENT, { userIds, model, modelId });
  }
}
