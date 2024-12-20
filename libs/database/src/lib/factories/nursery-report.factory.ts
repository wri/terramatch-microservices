import { FactoryGirl } from "factory-girl-ts";
import { NurseryReport } from "../entities";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { NurseryFactory } from "./nursery.factory";

export const NurseryReportFactory = FactoryGirl.define(NurseryReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  return {
    uuid: crypto.randomUUID(),
    nurseryId: NurseryFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() })
  };
});
