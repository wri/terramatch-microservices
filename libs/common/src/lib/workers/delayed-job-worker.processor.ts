import { OnWorkerEvent, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DelayedJob, Permission, User } from "@terramatch-microservices/database/entities";
import { FAILED, SUCCEEDED } from "@terramatch-microservices/database/constants/status";
import { TMLogger } from "../util/tm-logger";
import { isString } from "lodash";
import { DocumentBuilder, JsonApiDocument, ResourceBuilder } from "../util";
import * as Sentry from "@sentry/nestjs";
import { UserContext } from "../contexts/user.context";

export type DelayedJobData = {
  delayedJobId: number;
};

type ProgressUpdate = {
  totalContent?: DelayedJob["totalContent"];
  processedContent?: DelayedJob["processedContent"];
  progressMessage?: DelayedJob["progressMessage"];
};

export type DelayedJobResult = ProgressUpdate & { payload: JsonApiDocument | DocumentBuilder | ResourceBuilder };

export class DelayedJobException extends Error {
  constructor(
    public errorCode: number,
    message: string
  ) {
    super(message);
  }
}

const serializePayload = (result: DelayedJobResult) => ({
  ...result,
  payload:
    result.payload instanceof DocumentBuilder
      ? result.payload.serialize()
      : result.payload instanceof ResourceBuilder
        ? result.payload.document.serialize()
        : result.payload
});

export abstract class DelayedJobWorker<T extends DelayedJobData> extends WorkerHost {
  protected logger = new TMLogger(DelayedJobWorker.name);

  /* istanbul ignore next */
  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    this.logger.error(`Job failed: ${job.id}`, error, job);
    await Sentry.flush(2000);
  }

  async process(job: Job<T>) {
    const delayedJob = await DelayedJob.findOne({ where: { id: job.data.delayedJobId } });
    if (delayedJob == null) {
      this.logger.error(`Delayed job not found! ${job.data.delayedJobId}`);
      return;
    }

    try {
      await delayedJob.update({
        ...serializePayload(await this.processDelayedJobInUserContext(delayedJob, job)),
        status: SUCCEEDED,
        statusCode: 200
      });
    } catch (error) {
      this.logger.error(`Error processing delayed job ${JSON.stringify(job)}`, error);
      await delayedJob.update({
        status: FAILED,
        statusCode: error instanceof DelayedJobException ? error.errorCode : 500,
        payload: { message: isString(error) ? error : ((error as Error).message ?? "Unknown error occurred") }
      });
    }
  }

  abstract processDelayedJob(job: Job<T>): Promise<DelayedJobResult>;

  protected async processDelayedJobInUserContext({ createdBy }: DelayedJob, job: Job<T>) {
    if (createdBy == null) return await this.processDelayedJob(job);

    const permissions = await Permission.getUserPermissionNames(createdBy);
    const locale = (await User.findLocale(createdBy)) ?? "en-US";
    return await new Promise<DelayedJobResult>((resolve, reject) => {
      UserContext.use(createdBy, permissions, locale, () => {
        this.processDelayedJob(job).then(resolve, reject);
      });
    });
  }

  protected async updateJobProgress(job: Job<T>, update: ProgressUpdate) {
    await DelayedJob.update(update, { where: { id: job.data.delayedJobId } });
  }
}
