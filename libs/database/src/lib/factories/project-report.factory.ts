import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectFactory } from "./project.factory";
import { DateTime } from "luxon";
import { NO_UPDATE, PLANTING_STATUSES } from "../constants/status";
import { FRAMEWORK_KEYS } from "../constants/framework";
import { TaskFactory } from "./task.factory";

export const ProjectReportFactory = FactoryGirl.define(ProjectReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    projectId: ProjectFactory.associate("id"),
    taskId: TaskFactory.associate("id"),
    frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() }),
    updateRequestStatus: NO_UPDATE,
    plantingStatus: faker.helpers.arrayElement([null, ...PLANTING_STATUSES])
  };
});
