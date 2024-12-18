import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";
import { FactoryGirl } from "factory-girl-ts";
import { TreeSpecies } from "../entities";
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
  forNursery: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Nurseries\\Nursery",
    speciesableId: NurseryFactory.associate("id"),
    collection: "nursery-seedling"
  })),

  forNurseryReport: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Nurseries\\NurseryReport",
    speciesableId: NurseryReportFactory.associate("id"),
    collection: "nursery-seedling"
  })),

  forProject: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Projects\\Project",
    speciesableId: ProjectFactory.associate("id"),
    collection: "tree-planted"
  })),

  forProjectReport: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Projects\\ProjectReport",
    speciesableId: ProjectReportFactory.associate("id"),
    collection: "tree-planted"
  })),

  forSite: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Sites\\Site",
    speciesableId: SiteFactory.associate("id"),
    collection: "tree-planted"
  })),

  forSiteReport: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Sites\\SiteReport",
    speciesableId: SiteReportFactory.associate("id"),
    collection: "tree-planted"
  }))
};
