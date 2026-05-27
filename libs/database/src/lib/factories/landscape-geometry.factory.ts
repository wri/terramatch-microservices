import { FactoryGirl } from "factory-girl-ts";
import { LandscapeGeometry } from "../entities";
import { faker } from "@faker-js/faker";
import { POLYGON } from "./polygon-geometry.factory";

export const LandscapeGeometryFactory = FactoryGirl.define(LandscapeGeometry, async () => {
  // `landscape` is STRING(50); faker.location.country() can exceed 50 chars and break inserts.
  const id = faker.string.uuid();
  return {
    geometry: POLYGON,
    landscape: `LG-${id}`,
    slug: `ls-${id}`
  };
});
