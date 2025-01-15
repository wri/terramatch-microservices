import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport, SiteReport, Workday } from "../entities";
import { ProjectReportFactory } from "./project-report.factory";
import { SiteReportFactory } from "./site-report.factory";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  description: null,
  hidden: false
});

export const WorkdayFactory = {
  forProjectReport: FactoryGirl.define(Workday, async () => ({
    ...(await defaultAttributesFactory()),
    workdayableType: ProjectReport.LARAVEL_TYPE,
    workdayableId: ProjectReportFactory.associate("id")
  })),

  forSiteReport: FactoryGirl.define(Workday, async () => ({
    ...(await defaultAttributesFactory()),
    workdayableType: SiteReport.LARAVEL_TYPE,
    workdayableId: SiteReportFactory.associate("id")
  }))
};
