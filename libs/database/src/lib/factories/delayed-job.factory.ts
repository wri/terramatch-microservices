import { FactoryGirl } from "factory-girl-ts";
import { DelayedJob } from "../entities";

export const DelayedJobFactory = {
  succeeded: FactoryGirl.define(DelayedJob, async () => ({
    status: "succeeded",
    statusCode: 200,
    payload: { data: "test" },
    totalContent: 0,
    processedContent: 0,
    progressMessage: "test",
    isAcknowledged: false,
    createdBy: 1290
  })),

  pending: FactoryGirl.define(DelayedJob, async () => ({
    status: "pending",
    isAcknowledged: false,
    createdBy: 1290
  }))
};
