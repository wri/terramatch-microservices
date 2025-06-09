import { FinancialIndicator } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";

export const FinancialIndicatorFactory = FactoryGirl.define(FinancialIndicator, async () => ({
  id: faker.number.int({ min: 1, max: 1000000 }),
  uuid: faker.string.uuid(),
  name: faker.lorem.words(1),
  description: faker.lorem.words(1),
  createdAt: faker.date.recent(),
  updatedAt: faker.date.recent()
}));
