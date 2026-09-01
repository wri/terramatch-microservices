import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

export const USER_DATA_PUSH_QUEUE = "userSocket";
export const USER_DATA_PUSH_EVENT = "pushData";

export type UserDataPushEvent = {
  userId: number;
  payload: unknown;
};

@Injectable()
export class UserDataPushService {
  constructor(@InjectQueue(USER_DATA_PUSH_QUEUE) private readonly userDataQueue: Queue<UserDataPushEvent>) {}

  async sendData(userId: number, message: string) {
    await this.userDataQueue.add(USER_DATA_PUSH_EVENT, { userId, payload: message });
  }
}
