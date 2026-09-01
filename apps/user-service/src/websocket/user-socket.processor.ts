import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  USER_DATA_PUSH_EVENT,
  USER_DATA_PUSH_QUEUE,
  UserDataPushEvent
} from "@terramatch-microservices/common/userDataPush/user-data-push.service";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { isEmpty } from "lodash";
import { UserGateway } from "./user.gateway";

@Processor(USER_DATA_PUSH_QUEUE)
export class UserSocketProcessor extends WorkerHost {
  private readonly logger = new TMLogger(UserSocketProcessor.name);

  constructor(private readonly gateway: UserGateway) {
    super();
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    this.logger.error("Job failed", error, job);
  }

  async process(job: Job<UserDataPushEvent>) {
    const { name, data } = job;
    if (name !== USER_DATA_PUSH_EVENT) {
      throw new NotImplementedException(`Received unknown job ${name} with data ${JSON.stringify(data)}`);
    }

    const { userId, payload } = data;
    if (userId == null) {
      throw new InternalServerErrorException(`No user ID for user push event ${JSON.stringify(data)}`);
    }
    if (isEmpty(payload)) {
      throw new InternalServerErrorException(`No payload for user push event ${JSON.stringify(data)}`);
    }

    this.gateway.server.in(`user:${userId}`).emit("userDataPush", payload);
  }
}
