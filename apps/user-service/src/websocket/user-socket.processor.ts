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
import { AuthenticatedSocket, UserGateway } from "./user.gateway";
import { ModelSerializer } from "@terramatch-microservices/common/modelSerializers/model-serializer";
import { TasksSerializer } from "@terramatch-microservices/common/modelSerializers/tasks.serializer";
import { WebSocket } from "ws";

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

    await this.sendModelUpdate(userId, model, modelId);
  }

  private async sendModelUpdate(userId: number, model: UserDataModel, modelId: number) {
    if (process.env.NODE_ENV === "development") {
      // In local development, the client connects directly to this service's websocket connection,
      // and we manage it all locally
      await this.sendDevModelUpdate(userId, model, modelId);
    } else {
      // In AWS, the client connects to the Api Gateway websocket connection, and we send a request
      // to the AWS service to push an update to the client.
      await this.sendAwsModelUpdate(userId, model, modelId);
    }
  }

  private async sendDevModelUpdate(userId: number, model: UserDataModel, modelId: number) {
    const clients = [
      ...(this.gateway.server.clients as Set<AuthenticatedSocket>)
        .values()
        .filter(client => client.userId === userId && client.readyState === WebSocket.OPEN)
    ];
    if (clients.length === 0) return;

    const payload = JSON.stringify({ event: "userDataPush", data: await this.serializeDto(model, modelId) });
    for (const client of clients) {
      client.send(payload);
    }
  }

  private async sendAwsModelUpdate(userId: number, model: UserDataModel, modelId: number) {
    throw new NotImplementedException();
  }

  private async serializeDto(model: UserDataModel, modelId: number) {
    const serializer = SERIALIZERS[model];
    if (serializer == null) {
      throw new InternalServerErrorException(`Invalid model: ${model}`);
    }

    const instance = await serializer.findById(modelId);
    return (await serializer.addDto(serializer.createDocument(), instance)).document.serialize();
  }
}
