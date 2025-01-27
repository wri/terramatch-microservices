import { FactoryGirl } from "factory-girl-ts";
import { FundingProgramme } from "../entities";
import { faker } from "@faker-js/faker";

export const FundingProgrammeFactory = FactoryGirl.define(FundingProgramme, async () => ({
  uuid: crypto.randomUUID(),
  name: faker.animal.petName()
}));
