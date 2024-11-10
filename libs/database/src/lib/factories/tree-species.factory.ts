import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";
import { FactoryGirl } from "factory-girl-ts";
import { TreeSpecies } from "../entities";
import { SiteReportFactory } from "./site-report.factory";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  name: faker.lorem.words(2),
  amount: faker.number.int({ min: 10, max: 1000 }),
  collection: "tree-planted"
});

export const TreeSpeciesFactory = {
  forSite: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Sites\\Site",
    speciesableId: SiteFactory.associate("id")
  })),

  forSiteReport: FactoryGirl.define(TreeSpecies, async () => ({
    ...(await defaultAttributesFactory()),
    speciesableType: "App\\Models\\V2\\Sites\\SiteReport",
    speciesableId: SiteReportFactory.associate("id")
  }))
};
