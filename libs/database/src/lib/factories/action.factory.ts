import { Action, Project, ProjectReport } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { OrganisationFactory } from "./organisation.factory";
import { ProjectFactory } from "./project.factory";
import { ProjectReportFactory } from "./project-report.factory";

const defaultAttributesFactory = async () => ({
  type: "notification",
  organisationId: OrganisationFactory.associate("id"),
  projectId: ProjectFactory.associate("id")
});

export const ActionFactory = {
  forProjectReport: FactoryGirl.define(Action, async () => ({
    ...(await defaultAttributesFactory()),
    targetableType: ProjectReport.LARAVEL_TYPE,
    targetableId: ProjectReportFactory.associate("id")
  })),
  forProject: FactoryGirl.define(Action, async () => ({
    ...(await defaultAttributesFactory()),
    targetableType: Project.LARAVEL_TYPE,
    targetableId: ProjectFactory.associate("id")
  }))
};
