import { FactoryGirl } from "factory-girl-ts";
import { LandscapeGeometry } from "../entities";
import { faker } from "@faker-js/faker";
import { POLYGON } from "./polygon-geometry.factory";

export const LandscapeGeometryFactory = FactoryGirl.define(LandscapeGeometry, async () => ({
  geometry: POLYGON,
  landscape: faker.location.country()
}));
