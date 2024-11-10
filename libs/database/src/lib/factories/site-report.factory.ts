import { SiteReport } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { SiteFactory } from "./site.factory";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";

export const SiteReportFactory = FactoryGirl.define(SiteReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  return {
    uuid: crypto.randomUUID(),
    siteId: SiteFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() })
  };
});
