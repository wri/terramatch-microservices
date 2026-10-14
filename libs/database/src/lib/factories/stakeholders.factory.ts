import { FactoryGirl } from "factory-girl-ts";
import { ProjectPitch, Stakeholder } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectPitchFactory } from "./project-pitch.factory";
import { STAKEHOLDER_KEY_ROLES } from "../entities/stakeholder.entity";

export const StakeholdersFactory = {
  projectPitch: (projectPitch?: ProjectPitch) =>
    FactoryGirl.define(Stakeholder, async () => ({
      stakeholderableType: ProjectPitch.LARAVEL_TYPE,
      stakeholderableId: (projectPitch?.id as number) ?? ProjectPitchFactory.associate("id"),
      name: faker.company.name(),
      keyRole: faker.helpers.arrayElement(STAKEHOLDER_KEY_ROLES),
      description: faker.lorem.paragraph()
    }))
};
