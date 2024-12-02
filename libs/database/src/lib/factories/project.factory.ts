import { FactoryGirl } from "factory-girl-ts";
import { Project } from "../entities";

export const ProjectFactory = FactoryGirl.define(Project, async () => ({
  uuid: crypto.randomUUID()
}));
