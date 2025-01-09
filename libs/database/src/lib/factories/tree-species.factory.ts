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
  uuid: crypto.randomUUID(),
  name: faker.lorem.words(2),
  taxonId: null,
  amount: faker.number.int({ min: 10, max: 1000 }),
  collection: "tree-planted"
});

export const TreeSpeciesFactory = {
  forNurserySeedling: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: Nursery.LARAVEL_TYPE,
    speciesableId: NurseryFactory.associate("id"),
    collection: "nursery-seedling"
  })),

  forNurseryReportSeedling: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: NurseryReport.LARAVEL_TYPE,
    speciesableId: NurseryReportFactory.associate("id"),
    collection: "nursery-seedling"
  })),

  forProjectTreePlanted: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: Project.LARAVEL_TYPE,
    speciesableId: ProjectFactory.associate("id"),
    collection: "tree-planted"
  })),

  forProjectReportTreePlanted: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: ProjectReport.LARAVEL_TYPE,
    speciesableId: ProjectReportFactory.associate("id"),
    collection: "tree-planted"
  })),

  forSiteTreePlanted: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: Site.LARAVEL_TYPE,
    speciesableId: SiteFactory.associate("id"),
    collection: "tree-planted"
  })),

  forSiteNonTree: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: Site.LARAVEL_TYPE,
    speciesableId: SiteFactory.associate("id"),
    collection: "non-tree"
  })),

  forSiteReportTreePlanted: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: SiteReport.LARAVEL_TYPE,
    speciesableId: SiteReportFactory.associate("id"),
    collection: "tree-planted"
  })),

  forSiteReportNonTree: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: SiteReport.LARAVEL_TYPE,
    speciesableId: SiteReportFactory.associate("id"),
    collection: "non-tree"
  }))
};
