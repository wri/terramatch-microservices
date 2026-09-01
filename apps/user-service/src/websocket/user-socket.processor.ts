import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  USER_DATA_PUSH_EVENT,
  USER_DATA_PUSH_QUEUE,
  UserDataModel,
  UserDataPushEvent
} from "@terramatch-microservices/common/userDataPush/user-data-push.service";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { UserGateway } from "./user.gateway";
import { ModelSerializer } from "@terramatch-microservices/common/modelSerializers/util";
import { TasksSerializer } from "@terramatch-microservices/common/modelSerializers/tasks.serializer";

const SERIALIZERS: Record<UserDataModel, ModelSerializer> = {
  tasks: TasksSerializer
};

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

    const { userId, model, modelId } = data;
    if (userId == null) {
      throw new InternalServerErrorException(`No user ID for user push event ${JSON.stringify(data)}`);
    }
    if (model == null || modelId == null) {
      throw new InternalServerErrorException(`Model missing for user push event ${JSON.stringify(data)}`);
    }

    if ((await this.gateway.server.in(`user:${userId}`).fetchSockets()).length === 0) {
      return; // skip loading the model and serializing the DTO if there's nobody listening.
    }

    this.gateway.server.in(`user:${userId}`).emit("userDataPush", await this.serializeDto(model, modelId));
  }

  async serializeDto(model: UserDataModel, modelId: number) {
    const serializer = SERIALIZERS[model];
    if (serializer == null) {
      throw new InternalServerErrorException(`Invalid model: ${model}`);
    }

    const instance = await serializer.findById(modelId);
    return (await serializer.addFullDto(serializer.createDocument(), instance)).document.serialize();
  }
}
