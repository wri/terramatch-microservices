import { FactoryGirl } from "factory-girl-ts";
import { Project, Site, SiteReport, UpdateRequest } from "../entities";
import { ProjectFactory } from "./project.factory";
import { SiteFactory } from "./site.factory";
import { SiteReportFactory } from "./site-report.factory";

const defaultAttributesFactory = async () => ({
  status: "awaiting-approval"
});

export const UpdateRequestFactory = {
  project: (project?: Project) =>
    FactoryGirl.define(UpdateRequest, async () => ({
      ...(await defaultAttributesFactory()),
      updateRequestableType: Project.LARAVEL_TYPE,
      updateRequestableId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),

  site: (site?: Site) =>
    FactoryGirl.define(UpdateRequest, async () => ({
      ...(await defaultAttributesFactory()),
      updateRequestableType: Site.LARAVEL_TYPE,
      updateRequestableId: (site?.id as number) ?? SiteFactory.associate("id")
    })),

  siteReport: (report?: SiteReport) =>
    FactoryGirl.define(UpdateRequest, async () => ({
      ...(await defaultAttributesFactory()),
      updateRequestableType: SiteReport.LARAVEL_TYPE,
      updateRequestableId: (report?.id as number) ?? SiteReportFactory.associate("id")
    }))
};
