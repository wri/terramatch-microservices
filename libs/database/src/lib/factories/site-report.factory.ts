import { SiteReport } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { SiteFactory } from "./site.factory";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { UPDATE_REQUEST_STATUSES } from "../constants/status";
import { TaskFactory } from "./task.factory";

export const SiteReportFactory = FactoryGirl.define(SiteReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    siteId: SiteFactory.associate("id"),
    taskId: TaskFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() }),
    updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES),
    numTreesRegenerating: faker.number.int({ min: 10, max: 500 }),
    workdaysPaid: faker.number.int({ min: 10, max: 50 }),
    workdaysVolunteer: faker.number.int({ min: 10, max: 50 })
  };
});
