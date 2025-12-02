import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { DemographicEntry } from "../entities";
import { DemographicFactory } from "./demographic.factory";

const TYPES = ["gender", "age", "ethnicity", "caste"];
const SUBTYPES: Record<string, (null | string)[]> = {
  gender: ["male", "female", "non-binary"],
  age: ["youth", "adult", "elder"],
  ethnicity: ["indigenous", "unknown", "other"],
  caste: ["marginalized"]
};
const NAMES: Record<string, (null | string)[]> = {
  gender: [null],
  age: [null],
  ethnicity: ["Cuyono", "Tupiniquim", "Visaya"],
  caste: [null]
};

export const DemographicEntryFactory = FactoryGirl.define(DemographicEntry, async () => {
  const type = faker.helpers.arrayElement(TYPES);
  return {
    demographicId: DemographicFactory.projectReportWorkday().associate("id"),
    type,
    subtype: faker.helpers.arrayElement(SUBTYPES[type] ?? [null]),
    name: faker.helpers.arrayElement(NAMES[type] ?? [null]),
    amount: faker.number.int({ min: 10, max: 100 })
  };
});
