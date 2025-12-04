import { Leadership, Organisation } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { OrganisationFactory } from "./organisation.factory";
import { faker } from "@faker-js/faker";

const COLLECTIONS = ["core-team-leaders", "leadership-team"];

const defaultAttributesFactory = async () => ({
  collection: faker.helpers.arrayElement(COLLECTIONS),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  position: faker.person.jobTitle(),
  gender: faker.helpers.arrayElement(["male", "female"]),
  age: faker.number.int({ min: 18, max: 65 })
});

export const LeadershipFactory = {
  org: (org?: Organisation) =>
    FactoryGirl.define(Leadership, async () => ({
      ...(await defaultAttributesFactory()),
      organisationId: (org?.id as number) ?? OrganisationFactory.associate("id")
    }))
};
