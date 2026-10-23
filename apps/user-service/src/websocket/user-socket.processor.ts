import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  USER_DATA_DELETE_EVENT,
  USER_DATA_PUSH_EVENT,
  USER_DATA_PUSH_QUEUE,
  UserDataDeleteEvent,
  UserDataPushEvent
} from "@terramatch-microservices/common/userDataPush/user-data-push.service";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { UserGateway } from "./user.gateway";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { UserDataModel } from "@terramatch-microservices/database/types/user-model";
import { USER_DATA_SERIALIZERS } from "./user-data-serializers";

const SUPPORTED_EVENTS = [USER_DATA_PUSH_EVENT, USER_DATA_DELETE_EVENT] as const;
type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

type UserSocketEvent = UserDataPushEvent | UserDataDeleteEvent;

@Processor(USER_DATA_PUSH_QUEUE)
export class UserSocketProcessor extends WorkerHost {
  private readonly logger = new TMLogger(UserSocketProcessor.name);

  constructor(private readonly gateway: UserGateway) {
    super();
  }

  /* istanbul ignore next */
  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    this.logger.error("Job failed", error, job);
  }

  async process(job: Job<UserSocketEvent>) {
    const { name, data } = job;
    if (!SUPPORTED_EVENTS.includes(name as SupportedEvent)) {
      throw new NotImplementedException(`Received unknown job "${name}" with data ${JSON.stringify(data)}`);
    }
    const event = name as SupportedEvent;

    const { userIds, model } = data;
    if (userIds == null) {
      throw new InternalServerErrorException(`No user ID for user push event ${JSON.stringify(data)}`);
    }
    // The job name determines which shape of event data was queued.
    const resourceId =
      event === USER_DATA_PUSH_EVENT ? (data as UserDataPushEvent).modelId : (data as UserDataDeleteEvent).uuid;
    if (model == null || resourceId == null) {
      throw new InternalServerErrorException(`Model missing for user push event ${JSON.stringify(data)}`);
    }

    const userIdsOnline = (
      await Promise.all(
        userIds.map(async userId =>
          (await this.gateway.server.in(`user:${userId}`).fetchSockets()).length !== 0 ? userId : null
        )
      )
    ).filter(isNotNull);
    // skip loading the model and serializing the DTO if there's nobody listening.
    if (userIdsOnline.length === 0) return;

    const payload = await this.generatePayload(event, data);
    for (const userId of userIdsOnline) {
      this.gateway.server.in(`user:${userId}`).emit("userDataPush", payload);
    }
  }

  private async generatePayload(event: SupportedEvent, data: UserSocketEvent) {
    switch (event) {
      case USER_DATA_PUSH_EVENT:
        return await this.serializeDto(data as UserDataPushEvent);
      case USER_DATA_DELETE_EVENT:
        return this.serializer(data.model).serializeDeletion((data as UserDataDeleteEvent).uuid);

      default:
        /* istanbul ignore next */
        throw new InternalServerErrorException(`Unsupported event: ${event}`);
    }
  }

  private serializer(model: UserDataModel) {
    const serializer = USER_DATA_SERIALIZERS[model];
    if (serializer == null) {
      throw new InternalServerErrorException(`Invalid model: ${model}`);
    }

    return serializer;
  }

  private async serializeDto({ model, modelId }: UserDataPushEvent) {
    const serializer = this.serializer(model);
    const instance = await serializer.findById(modelId);
    return (await serializer.addDto(serializer.createDocument(), instance)).document.serialize();
  }
}
