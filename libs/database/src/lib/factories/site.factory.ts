import { Site } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";

export const SiteFactory = FactoryGirl.define(Site, async () => ({
  uuid: crypto.randomUUID(),
  projectId: ProjectFactory.associate("id")
}));
