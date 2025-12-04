import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";
import { FactoryGirl } from "factory-girl-ts";
import { Nursery, NurseryReport, Project, ProjectReport, Site, SiteReport, TreeSpecies } from "../entities";
import { SiteReportFactory } from "./site-report.factory";
import { ProjectFactory } from "./project.factory";
import { NurseryReportFactory } from "./nursery-report.factory";
import { ProjectReportFactory } from "./project-report.factory";
import { NurseryFactory } from "./nursery.factory";

const defaultAttributesFactory = async () => ({
  name: faker.lorem.words(2),
  taxonId: null,
  amount: faker.number.int({ min: 10, max: 1000 }),
  collection: "tree-planted",
  hidden: false
});

export const TreeSpeciesFactory = {
  nurserySeedling: (nursery?: Nursery) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: Nursery.LARAVEL_TYPE,
      speciesableId: (nursery?.id as number) ?? NurseryFactory.associate("id"),
      collection: "nursery-seedling"
    })),

  nurseryReportSeedling: (report?: NurseryReport) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: NurseryReport.LARAVEL_TYPE,
      speciesableId: (report?.id as number) ?? NurseryReportFactory.associate("id"),
      collection: "nursery-seedling"
    })),

  projectTreePlanted: (project?: Project) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: Project.LARAVEL_TYPE,
      speciesableId: (project?.id as number) ?? ProjectFactory.associate("id"),
      collection: "tree-planted"
    })),

  projectReportNurserySeedling: (report?: ProjectReport) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: ProjectReport.LARAVEL_TYPE,
      speciesableId: (report?.id as number) ?? ProjectReportFactory.associate("id"),
      collection: "nursery-seedling"
    })),

  siteTreePlanted: (site?: Site) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: Site.LARAVEL_TYPE,
      speciesableId: (site?.id as number) ?? SiteFactory.associate("id"),
      collection: "tree-planted"
    })),

  siteNonTree: (site?: Site) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: Site.LARAVEL_TYPE,
      speciesableId: (site?.id as number) ?? SiteFactory.associate("id"),
      collection: "non-tree"
    })),

  siteReportTreePlanted: (report?: SiteReport) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: SiteReport.LARAVEL_TYPE,
      speciesableId: (report?.id as number) ?? SiteReportFactory.associate("id"),
      collection: "tree-planted"
    })),

  siteReportNonTree: (report?: SiteReport) =>
    FactoryGirl.define(TreeSpecies, async () => ({
      ...(await defaultAttributesFactory()),
      speciesableType: SiteReport.LARAVEL_TYPE,
      speciesableId: (report?.id as number) ?? SiteReportFactory.associate("id"),
      collection: "non-tree"
    }))
};
