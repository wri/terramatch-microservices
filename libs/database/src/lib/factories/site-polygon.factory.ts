import { SitePolygon } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { SiteFactory } from "./site.factory";
import { faker } from "@faker-js/faker";
import { UserFactory } from "./user.factory";
import { PolygonGeometryFactory } from "./polygon-geometry.factory";

const PRACTICES = [
  "agroforestry",
  "planting",
  "enrichment",
  "applied-nucleation",
  "direct-seeding",
  "assisted-natural-regeneration"
];

const TARGET_SYS = ["riparian-area-or-wetland", "woodlot-or-plantation", "mangrove", "urban-forest", "agroforestry"];

const DISTR = ["single-line", "partial", "full-enrichment"];

export const SitePolygonFactory = FactoryGirl.define(SitePolygon, async () => {
  const uuid = crypto.randomUUID();
  const name = faker.lorem.words({ min: 3, max: 7 });
  const createdBy = UserFactory.associate("id");
  return {
    uuid,
    primaryUuid: uuid,
    siteUuid: SiteFactory.associate("uuid"),
    polygonUuid: PolygonGeometryFactory.associate("uuid"),
    polyName: name,
    practice: faker.helpers.arrayElements(PRACTICES, { min: 1, max: 4 }),
    targetSys: faker.helpers.arrayElement(TARGET_SYS),
    distr: faker.helpers.arrayElements(DISTR, { min: 1, max: 2 }),
    numTrees: faker.number.int({ min: 0, max: 1000000 }),
    status: "submitted",
    lat: faker.location.latitude({ min: -90, max: 90, precision: 16 }),
    long: faker.location.longitude({ min: -180, max: 180, precision: 16 }),
    source: "terramatch",
    createdBy: createdBy.get("id"),
    isActive: true,
    versionName: name,
    calcArea: faker.number.float({ min: 0.5, max: 1000 })
  };
});
