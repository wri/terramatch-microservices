import { FactoryGirl } from "factory-girl-ts";
import { ApiKey } from "../entities";
import { UserFactory } from "./user.factory";

export const ApiKeyFactory = FactoryGirl.define(ApiKey, async () => ({
  userId: UserFactory.associate("id"),
  key: ApiKey.generateKey()
}));
