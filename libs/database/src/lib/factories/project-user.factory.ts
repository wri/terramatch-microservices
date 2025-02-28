import { FactoryGirl } from "factory-girl-ts";
import { ProjectUser } from "../entities";

export const ProjectUserFactory = FactoryGirl.define(ProjectUser, async () => ({
  status: "active",
  isMonitoring: true,
  isManaging: false
}));
