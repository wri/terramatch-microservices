import { FactoryGirl } from "factory-girl-ts";
import { FundingProgramme } from "../entities";
import { faker } from "@faker-js/faker";

export const FundingProgrammeFactory = FactoryGirl.define(FundingProgramme, async () => ({
  name: faker.animal.petName(),
  description: faker.lorem.paragraph(),
  location: faker.location.city()
}));
