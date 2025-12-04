import { FactoryGirl } from "factory-girl-ts";
import { Invasive, Site } from "../entities";
import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";

const TYPES = ["common", "uncommon", "dominant_species"];

const defaultAttributesFactory = async () => ({
  type: faker.helpers.arrayElement(TYPES),
  name: faker.lorem.words(2)
});

export const InvasiveFactory = {
  site: (site?: Site) =>
    FactoryGirl.define(Invasive, async () => ({
      ...(await defaultAttributesFactory()),
      invasiveableType: Site.LARAVEL_TYPE,
      invasiveableId: (site?.id as number) ?? SiteFactory.associate("id")
    }))
};
