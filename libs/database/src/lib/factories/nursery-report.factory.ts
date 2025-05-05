import { FactoryGirl } from "factory-girl-ts";
import { NurseryReport } from "../entities";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { NurseryFactory } from "./nursery.factory";
import { TaskFactory } from "./task.factory";
import { NO_UPDATE } from "../constants/status";

export const NurseryReportFactory = FactoryGirl.define(NurseryReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    nurseryId: NurseryFactory.associate("id"),
    taskId: TaskFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() }),
    updateRequestStatus: NO_UPDATE
  };
});
