import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { Role } from "@terramatch-microservices/database/entities";

export const RoleFactory = FactoryGirl.define(Role, async () => ({
  name: faker.word.noun()
}));
