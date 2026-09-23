import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { ResearchTreeCount } from "../entities";
import { ProjectFactory } from "./project.factory";
import { VERIFICATION_METHODS } from "../constants/reseach-tree-count";

export const ResearchTreeCountFactory = FactoryGirl.define(ResearchTreeCount, async () => {
  const treeCountAdj = faker.number.int({ min: 1000, max: 100000 });
  return {
    projectId: ProjectFactory.associate("id"),
    verificationMethod: faker.helpers.arrayElement(VERIFICATION_METHODS),
    reportedCount: faker.number.int({ min: 1000, max: 100000 }),
    treeCountAdj,
    upperBounds: treeCountAdj + faker.number.int({ min: 0, max: 1000 }),
    lowerBounds: treeCountAdj - faker.number.int({ min: 0, max: 1000 })
  };
});
