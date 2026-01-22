import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { User } from "../entities";

export const UserFactory = FactoryGirl.define(User, async () => ({
  locale: "en-US",
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  emailAddress: await generateUniqueEmail(),
  emailAddressVerifiedAt: new Date()
}));

async function generateUniqueEmail() {
  let emailAddress = faker.internet.email();

  while ((await User.count({ where: { emailAddress } })) !== 0) {
    emailAddress = faker.internet.email();
  }

  return emailAddress;
}
