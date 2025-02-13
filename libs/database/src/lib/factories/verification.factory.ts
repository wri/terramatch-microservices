import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { Verification } from "../entities";

export const VerificationFactory = FactoryGirl.define(Verification, async () => ({
  token: faker.lorem.word(),
  userId: faker.number
}));
