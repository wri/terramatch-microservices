import { FactoryGirl } from "factory-girl-ts";
import { Nursery } from "../entities";
import { ProjectFactory } from "./project.factory";

export const NurseryFactory = FactoryGirl.define(Nursery, async () => ({
  uuid: crypto.randomUUID(),
  projectId: ProjectFactory.associate("id")
}));
