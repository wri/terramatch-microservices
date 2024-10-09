import { Organisation } from '../entities';
import { FactoryGirl } from 'factory-girl-ts';
import { faker } from '@faker-js/faker';

export const OrganisationFactory = FactoryGirl.define(Organisation, async () => ({
  uuid: crypto.randomUUID(),
  status: 'approved',
  type: 'non-profit-organisation',
  name: faker.company.name()
}))
