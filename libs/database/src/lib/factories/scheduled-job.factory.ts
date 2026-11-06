import { ScheduledJob } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SITE_AND_NURSERY_REMINDER, TASK_DUE } from "../constants/scheduled-jobs";

const defaultAttributesFactory = async () => ({
  executionTime: faker.date.recent()
});

export const ScheduledJobFactory = {
  forTaskDue: FactoryGirl.define(ScheduledJob, async () => ({
    ...(await defaultAttributesFactory()),
    type: TASK_DUE,
    taskDefinition: { frameworkKey: "terrafund-non-profits", dueAt: faker.date.soon().toISOString() }
  })),

  forSiteAndNurseryReminder: FactoryGirl.define(ScheduledJob, async () => ({
    ...(await defaultAttributesFactory()),
    type: SITE_AND_NURSERY_REMINDER,
    taskDefinition: { frameworkKey: "terrafund-non-profits" }
  }))
};
