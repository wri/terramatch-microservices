import { FactoryGirl } from 'factory-girl-ts';
import { faker } from '@faker-js/faker';
import { LocalizationKey } from "../entities";

export const LocalizationKeyFactory = FactoryGirl.define(LocalizationKey, async () => ({
  key: faker.lorem.word(),
  value: faker.lorem.sentence(),
  valueId: faker.number.int({ min: 1, max: 1000 }),
}));
