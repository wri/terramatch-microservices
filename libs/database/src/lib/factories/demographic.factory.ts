import { FactoryGirl } from "factory-girl-ts";
import { Demographic, RestorationPartner, Workday } from "../entities";
import { WorkdayFactory } from "./workday.factory";
import { faker } from "@faker-js/faker";
import { RestorationPartnerFactory } from "./restoration-partner.factory";

const TYPES = ["gender", "age", "ethnicity", "caste"];
const NAMES: Record<string, (null | string)[]> = {
  gender: ["male", "female", "non-binary"],
  age: ["youth", "adult", "elder"],
  ethnicity: ["Cuyono", "Tupiniquim", "Visaya"],
  caste: ["marginalized"]
};
const SUBTYPES: Record<string, (null | string)[]> = {
  gender: [null],
  age: [null],
  ethnicity: ["indigenous", "unknown", "other"],
  caste: [null]
};

const defaultAttributesFactory = async () => {
  const type = faker.helpers.arrayElement(TYPES);
  return {
    uuid: crypto.randomUUID(),
    amount: faker.number.int({ min: 10, max: 100 }),
    type,
    subtype: faker.helpers.arrayElement(SUBTYPES[type] ?? [null]),
    name: faker.helpers.arrayElement(NAMES[type] ?? [null])
  };
};

export const DemographicFactory = {
  forWorkday: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: Workday.LARAVEL_TYPE,
    demographicalId: WorkdayFactory.forProjectReport.associate("id")
  })),

  forRestorationPartner: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: RestorationPartner.LARAVEL_TYPE,
    demographicalId: RestorationPartnerFactory.forProjectReport.associate("id")
  }))
};
