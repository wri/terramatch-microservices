import { FactoryGirl } from "factory-girl-ts";
import { Application } from "../entities";
import { OrganisationFactory } from "./organisation.factory";
import { FundingProgrammeFactory } from "./funding-programme.factory";

export const ApplicationFactory = FactoryGirl.define(Application, async () => ({
  organisationUuid: OrganisationFactory.associate("uuid"),
  fundingProgrammeUuid: FundingProgrammeFactory.associate("uuid")
}));
