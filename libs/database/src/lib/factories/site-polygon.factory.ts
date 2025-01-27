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
    practice: faker.helpers.arrayElements(PRACTICES, { min: 1, max: 4 }).join(","),
    targetSys: faker.helpers.arrayElements(TARGET_SYS, { min: 1, max: 3 }).join(","),
    distr: faker.helpers.arrayElements(DISTR, { min: 1, max: 2 }).join(","),
    numTrees: faker.number.int({ min: 0, max: 1000000 }),
    status: "submitted",
    source: "terramatch",
    createdBy: createdBy.get("id"),
    isActive: true,
    versionName: name,
    calcArea: faker.number.float({ min: 0.5, max: 1000 })
  };
});
