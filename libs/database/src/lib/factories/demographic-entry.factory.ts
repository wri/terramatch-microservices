import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { Demographic, DemographicEntry } from "../entities";
import { DemographicFactory } from "./demographic.factory";

const TYPES = ["gender", "age", "ethnicity", "caste"] as const;
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

const defaultAttributesFactory = async (type?: (typeof TYPES)[number], subtype?: string, name?: string) => {
  type ??= faker.helpers.arrayElement(TYPES);
  return {
    type,
    subtype: subtype ?? faker.helpers.arrayElement(SUBTYPES[type] ?? [null]),
    name: name ?? faker.helpers.arrayElement(NAMES[type] ?? [null]),
    amount: faker.number.int({ min: 10, max: 100 })
  };
};

export const DemographicEntryFactory = {
  any: (demographic?: Demographic) =>
    FactoryGirl.define(DemographicEntry, async () => ({
      ...(await defaultAttributesFactory()),
      demographicId: (demographic?.id as number) ?? DemographicFactory.projectReportWorkday().associate("id")
    })),

  gender: (demographic?: Demographic, subtype?: string) =>
    FactoryGirl.define(DemographicEntry, async () => ({
      ...(await defaultAttributesFactory("gender", subtype)),
      demographicId: (demographic?.id as number) ?? DemographicFactory.projectReportWorkday().associate("id")
    })),

  age: (demographic?: Demographic, subtype?: string) =>
    FactoryGirl.define(DemographicEntry, async () => ({
      ...(await defaultAttributesFactory("age", subtype)),
      demographicId: (demographic?.id as number) ?? DemographicFactory.projectReportWorkday().associate("id")
    })),

  ethnicity: (demographic?: Demographic, subtype?: string, name?: string) =>
    FactoryGirl.define(DemographicEntry, async () => ({
      ...(await defaultAttributesFactory("ethnicity", subtype, name)),
      demographicId: (demographic?.id as number) ?? DemographicFactory.projectReportWorkday().associate("id")
    })),

  caste: (demographic?: Demographic, subtype?: string, name?: string) =>
    FactoryGirl.define(DemographicEntry, async () => ({
      ...(await defaultAttributesFactory("caste", subtype, name)),
      demographicId: (demographic?.id as number) ?? DemographicFactory.projectReportWorkday().associate("id")
    }))
};
