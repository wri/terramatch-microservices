import { FactoryGirl } from "factory-girl-ts";
import { Task } from "../entities";
import { ProjectReportFactory } from "./project-report.factory";

export const TaskFactory = FactoryGirl.define(Task, async () => {
  return {
    uuid: crypto.randomUUID()
  };
});
