import { FactoryGirl } from 'factory-girl-ts';
import { faker } from '@faker-js/faker';
import { User } from '../entities';

// TODO: generate correctly hashed passwords. This will be easily accomplished once user signup
//   has been implemented in this codebase.
export const UserFactory = FactoryGirl.define(User, async () => ({
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  emailAddress: await generateUniqueEmail(),
  emailAddressVerifiedAt: new Date(),
  uuid: crypto.randomUUID(),
}));

async function generateUniqueEmail() {
  let emailAddress = faker.internet.email();

  while (await User.findOne({ where: { emailAddress } }) != null) {
    emailAddress = faker.internet.email();
  }

  return emailAddress;
}
