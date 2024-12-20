import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectFactory } from "./project.factory";
import { DateTime } from "luxon";

export const ProjectReportFactory = FactoryGirl.define(ProjectReport, async () => {
  const dueAt = faker.date.past({ years: 2 });
  return {
    uuid: crypto.randomUUID(),
    projectId: ProjectFactory.associate("id"),
    dueAt,
    submittedAt: faker.date.between({ from: dueAt, to: DateTime.fromJSDate(dueAt).plus({ days: 14 }).toJSDate() })
  };
});
