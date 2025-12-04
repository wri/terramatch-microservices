import { Organisation, OwnershipStake } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { OrganisationFactory } from "./organisation.factory";
import { faker } from "@faker-js/faker";

const defaultAttributesFactory = async () => ({
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  title: faker.person.jobTitle(),
  gender: faker.helpers.arrayElement(["male", "female", "non-binary"]),
  percentOwnership: faker.number.int({ min: 0, max: 100 }),
  yearOfBirth: faker.number.int({ min: 1960, max: 2000 })
});

export const OwnershipStakeFactory = {
  org: (org?: Organisation) =>
    FactoryGirl.define(OwnershipStake, async () => ({
      ...(await defaultAttributesFactory()),
      organisationId: (org?.uuid as string) ?? OrganisationFactory.associate("id")
    }))
};
