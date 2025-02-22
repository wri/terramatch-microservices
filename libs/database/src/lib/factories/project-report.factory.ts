import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectFactory } from "./project.factory";
import { DateTime } from "luxon";
import { REPORT_STATUSES, UPDATE_REQUEST_STATUSES } from "../constants/status";

export const ProjectReportFactory = FactoryGirl.define(ProjectReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    uuid: crypto.randomUUID(),
    projectId: ProjectFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() }),
    status: faker.helpers.arrayElement(REPORT_STATUSES),
    updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES),
    workdaysPaid: faker.number.int({ min: 10, max: 50 }),
    workdaysVolunteer: faker.number.int({ min: 10, max: 50 }),
    ftTotal: faker.number.int({ min: 10, max: 50 }),
    ptTotal: faker.number.int({ min: 10, max: 50 })
  };
});
