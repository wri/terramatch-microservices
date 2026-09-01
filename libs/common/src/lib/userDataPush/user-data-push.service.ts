import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

export const USER_DATA_PUSH_QUEUE = "userSocket";
export const USER_DATA_PUSH_EVENT = "pushData";

export const USER_DATA_MODELS = ["tasks"] as const;
export type UserDataModel = (typeof USER_DATA_MODELS)[number];

export type UserDataPushEvent = {
  userId: number;
  model: UserDataModel;
  modelId: number;
};

@Injectable()
export class UserDataPushService {
  constructor(@InjectQueue(USER_DATA_PUSH_QUEUE) private readonly userDataQueue: Queue<UserDataPushEvent>) {}

  async sendData(userId: number, model: UserDataModel, modelId: number) {
    await this.userDataQueue.add(USER_DATA_PUSH_EVENT, { userId, model, modelId });
  }
}
