import { FactoryGirl } from "factory-girl-ts";
import { ProjectPitch } from "../entities";
import { fakerCountries, fakerStates } from "../util/gadm-mock-data";

export const ProjectPitchFactory = FactoryGirl.define(ProjectPitch, async () => {
  const projectCountry = fakerCountries()[0];

  return {
    projectCountry,
    states: fakerStates([projectCountry], 3)
  };
});
