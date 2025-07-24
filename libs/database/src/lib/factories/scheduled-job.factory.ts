import { ScheduledJob } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { REPORT_REMINDER, SITE_AND_NURSERY_REMINDER, TASK_DUE } from "../constants/scheduled-jobs";

const defaultAttributesFactory = async () => ({
  executionTime: faker.date.recent()
});

export const ScheduledJobFactory = {
  forTaskDue: FactoryGirl.define(ScheduledJob, async () => ({
    ...(await defaultAttributesFactory()),
    type: TASK_DUE,
    taskDefinition: { framework_key: "terrafund", due_at: faker.date.soon().toISOString() }
  })),

  forReportReminder: FactoryGirl.define(ScheduledJob, async () => ({
    ...(await defaultAttributesFactory()),
    type: REPORT_REMINDER,
    taskDefinition: { framework_key: "terrafund" }
  })),

  forSiteAndNurseryReminder: FactoryGirl.define(ScheduledJob, async () => ({
    ...(await defaultAttributesFactory()),
    type: SITE_AND_NURSERY_REMINDER,
    taskDefinition: { framework_key: "terrafund" }
  }))
};
