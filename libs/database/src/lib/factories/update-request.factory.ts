import { FactoryGirl } from "factory-girl-ts";
import { Project, Site, UpdateRequest } from "../entities";
import { ProjectFactory } from "./project.factory";
import { SiteFactory } from "./site.factory";

const defaultAttributesFactory = async () => ({
  status: "awaiting-approval"
});

export const UpdateRequestFactory = {
  forProject: (project?: Project) =>
    FactoryGirl.define(UpdateRequest, async () => ({
      ...(await defaultAttributesFactory()),
      updateRequestableType: Project.LARAVEL_TYPE,
      updateRequestableId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),

  forSite: (site?: Site) =>
    FactoryGirl.define(UpdateRequest, async () => ({
      ...(await defaultAttributesFactory()),
      updateRequestableType: Site.LARAVEL_TYPE,
      updateRequestableId: (site?.id as number) ?? SiteFactory.associate("id")
    }))
};
