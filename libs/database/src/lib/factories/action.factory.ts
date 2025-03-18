import { Action, Project } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { OrganisationFactory } from "./organisation.factory";
import { ProjectFactory } from "./project.factory";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  organisationId: OrganisationFactory.associate("id"),
  projectId: ProjectFactory.associate("id")
});

export const ActionFactory = {
  forProject: FactoryGirl.define(Action, async () => ({
    ...(await defaultAttributesFactory()),
    targetableType: Project.LARAVEL_TYPE,
    targetableId: ProjectFactory.associate("id")
  }))
};
