import { FactoryGirl } from "factory-girl-ts";
import { ProjectUser } from "../entities";

export const ProjectUserFactory = FactoryGirl.define(ProjectUser, async () => ({
  isMonitoring: true,
  isManaging: false
}));
