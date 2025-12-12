import { FactoryGirl } from "factory-girl-ts";
import { Stage } from "../entities";
import { faker } from "@faker-js/faker";
import { FundingProgrammeFactory } from "./funding-programme.factory";

export const StageFactory = FactoryGirl.define(Stage, async () => ({
  name: faker.animal.petName(),
  order: 1,
  fundingProgrammeId: FundingProgrammeFactory.associate("uuid"),
  deadlineAt: faker.date.future()
}));
