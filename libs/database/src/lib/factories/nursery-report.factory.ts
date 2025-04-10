import { FactoryGirl } from "factory-girl-ts";
import { NurseryReport } from "../entities";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { NurseryFactory } from "./nursery.factory";
import { REPORT_STATUSES, UPDATE_REQUEST_STATUSES } from "../constants/status";

export const NurseryReportFactory = FactoryGirl.define(NurseryReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    nurseryId: NurseryFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() }),
    status: faker.helpers.arrayElement(REPORT_STATUSES),
    updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES)
  };
});
