import { FactoryGirl } from "factory-girl-ts";
import { Site, Strata } from "../entities";
import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";

const defaultAttributesFactory = async () => ({
  extent: faker.number.int({ min: 1, max: 100 }),
  description: faker.lorem.sentence()
});

export const StratasFactory = {
  site: (site?: Site) =>
    FactoryGirl.define(Strata, async () => ({
      ...(await defaultAttributesFactory()),
      stratasableType: Site.LARAVEL_TYPE,
      stratasableId: (site?.id as number) ?? SiteFactory.associate("id")
    }))
};
