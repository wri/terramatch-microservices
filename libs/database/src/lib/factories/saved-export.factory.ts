import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SavedExport } from "../entities";
import { FundingProgrammeFactory } from "./funding-programme.factory";

export const SavedExportFactory = FactoryGirl.define(SavedExport, async () => ({
  name: faker.lorem.slug(),
  fundingProgrammeId: FundingProgrammeFactory.associate("id")
}));
