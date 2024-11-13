import { Site } from "../entities";
import { FactoryGirl } from "factory-girl-ts";

export const SiteFactory = FactoryGirl.define(Site, async () => ({
  uuid: crypto.randomUUID()
}));
