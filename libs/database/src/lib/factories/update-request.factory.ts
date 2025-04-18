import { FactoryGirl } from "factory-girl-ts";
import { Project, UpdateRequest } from "../entities";
import { ProjectFactory } from "./project.factory";

const defaultAttributesFactory = async () => ({
  status: "awaiting-approval"
});

export const UpdateRequestFactory = {
  forProject: FactoryGirl.define(UpdateRequest, async () => ({
    ...(await defaultAttributesFactory()),
    updateRequestableType: Project.LARAVEL_TYPE,
    updateRequestableId: ProjectFactory.associate("id")
  }))
};
